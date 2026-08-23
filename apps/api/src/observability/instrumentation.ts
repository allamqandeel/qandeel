import { NodeSDK } from '@opentelemetry/sdk-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import type { Attributes, SpanStatus } from '@opentelemetry/api';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';

const SAFE_HTTP_ATTRIBUTES=new Set(['http.request.method','http.response.status_code','http.route','http.method','http.status_code']);
const AUTOMATIC_HTTP_SCOPES=new Set(['@opentelemetry/instrumentation-http','@opentelemetry/instrumentation-express']);

function bounded(value:unknown,limit:number):string|undefined{return typeof value==='string'&&value.length>0?value.slice(0,limit):undefined;}
function safeRoute(value:unknown):string|undefined{const route=bounded(value,256);return route&&(route==='/'||/[:*{}]/.test(route))&&!route.includes('?')?route:undefined;}

export function sanitizeHttpSpanAttributes(attributes:Attributes):Attributes{
 const safe:Attributes={};
 for(const[key,value]of Object.entries(attributes)){
  if(!SAFE_HTTP_ATTRIBUTES.has(key))continue;
  if(key==='http.route'){const route=safeRoute(value);if(route)safe[key]=route;}
  else if((key==='http.request.method'||key==='http.method')&&typeof value==='string')safe[key]=value.slice(0,16);
  else if(typeof value==='number')safe[key]=value;
 }
 return safe;
}

export function sanitizeAutomaticHttpSpan(span:ReadableSpan):ReadableSpan{
 const attributes=sanitizeHttpSpanAttributes(span.attributes),method=bounded(attributes['http.request.method']??attributes['http.method'],16),route=safeRoute(attributes['http.route']);
 const status:SpanStatus={code:span.status.code};
 return{
  name:`${method??'HTTP'} ${route??'request'}`.slice(0,280),kind:span.kind,spanContext:()=>span.spanContext(),parentSpanContext:span.parentSpanContext,
  startTime:span.startTime,endTime:span.endTime,status,attributes,links:span.links,events:[],duration:span.duration,ended:span.ended,
  resource:span.resource,instrumentationScope:span.instrumentationScope,droppedAttributesCount:span.droppedAttributesCount,
  droppedEventsCount:span.droppedEventsCount,droppedLinksCount:span.droppedLinksCount,
 };
}

export class PrivacySafeSpanExporter implements SpanExporter{
 constructor(private readonly delegate:SpanExporter){}
 export(spans:ReadableSpan[],callback:Parameters<SpanExporter['export']>[1]):void{this.delegate.export(spans.map(span=>AUTOMATIC_HTTP_SCOPES.has(span.instrumentationScope.name)?sanitizeAutomaticHttpSpan(span):span),callback);}
 shutdown():Promise<void>{return this.delegate.shutdown();}forceFlush():Promise<void>{return this.delegate.forceFlush?.()??Promise.resolve();}
}

export const hasExplicitTraceEndpoint=(environment:NodeJS.ProcessEnv):boolean=>Boolean(environment.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT||environment.OTEL_EXPORTER_OTLP_ENDPOINT);
export const hasExplicitMetricEndpoint=(environment:NodeJS.ProcessEnv):boolean=>Boolean(environment.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT||environment.OTEL_EXPORTER_OTLP_ENDPOINT);

export interface TelemetryBootstrapFactories{
 createTraceExporter:()=>SpanExporter;createMetricExporter:()=>OTLPMetricExporter;createMetricReader:(exporter:OTLPMetricExporter)=>PeriodicExportingMetricReader;createSdk:(options:ConstructorParameters<typeof NodeSDK>[0])=>NodeSDK;
}
const defaultFactories:TelemetryBootstrapFactories={createTraceExporter:()=>new OTLPTraceExporter(),createMetricExporter:()=>new OTLPMetricExporter(),createMetricReader:exporter=>new PeriodicExportingMetricReader({exporter}),createSdk:options=>new NodeSDK(options)};

export function initializeTelemetry(environment:NodeJS.ProcessEnv,factories:TelemetryBootstrapFactories=defaultFactories):NodeSDK|undefined{
 if(environment.NODE_ENV==='test')return undefined;
 try{
  const traceExporter=hasExplicitTraceEndpoint(environment)?new PrivacySafeSpanExporter(factories.createTraceExporter()):undefined;
  const metricReader=hasExplicitMetricEndpoint(environment)?factories.createMetricReader(factories.createMetricExporter()):undefined;
  const sdk=factories.createSdk({resource:resourceFromAttributes({'service.name':environment.OTEL_SERVICE_NAME??'qandeel-api','service.version':environment.npm_package_version??'0.1.0','deployment.environment.name':environment.NODE_ENV??'development'}),instrumentations:[new HttpInstrumentation({disableOutgoingRequestInstrumentation:true,headersToSpanAttributes:{server:{requestHeaders:[],responseHeaders:[]}},enableSyntheticSourceDetection:false}),new ExpressInstrumentation()],...(traceExporter?{traceExporter}:{spanProcessors:[]}as const),...(metricReader?{metricReader}:{})});
  sdk.start();return sdk;
 }catch{return undefined;}
}

export let telemetrySdk:NodeSDK|undefined=initializeTelemetry(process.env);
