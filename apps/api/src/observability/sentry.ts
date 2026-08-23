import * as Sentry from '@sentry/nestjs';
import { correlation } from './shared-correlation';

export function sanitizeSentryEvent(event:any):any{try{
  if(event.request){const method=typeof event.request.method==='string'?event.request.method.slice(0,16):undefined;event.request={...(method?{method}:{})};}
  delete event.user;delete event.extra;delete event.breadcrumbs;delete event.contexts;delete event.message;delete event.logentry;delete event.transaction;delete event.transaction_info;
  if(event.exception?.values)for(const value of event.exception.values){delete value.value;if(value.stacktrace?.frames)value.stacktrace.frames=value.stacktrace.frames.map((frame:any)=>({...(typeof frame.filename==='string'?{filename:frame.filename.slice(0,256)}:{}),...(typeof frame.function==='string'?{function:frame.function.slice(0,128)}:{}),...(typeof frame.module==='string'?{module:frame.module.slice(0,128)}:{}),...(Number.isInteger(frame.lineno)?{lineno:frame.lineno}:{}),...(Number.isInteger(frame.colno)?{colno:frame.colno}:{}),...(typeof frame.in_app==='boolean'?{in_app:frame.in_app}:{})}));}
  const current=correlation.current();event.tags=current?Object.fromEntries(Object.entries(current).map(([key,value])=>[`qandeel.${key}`,String(value).slice(0,128)])):{};
  return event;
}catch{return null;}}

export const sentryOptions={dsn:process.env.SENTRY_DSN,enabled:Boolean(process.env.SENTRY_DSN)&&process.env.NODE_ENV!=='test',tracesSampleRate:0,skipOpenTelemetrySetup:true,sendDefaultPii:false,beforeSend:sanitizeSentryEvent,beforeBreadcrumb:(_breadcrumb:any)=>null};
if(sentryOptions.enabled)try{Sentry.init(sentryOptions);}catch{}
