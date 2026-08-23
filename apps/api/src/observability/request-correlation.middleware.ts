import { Injectable,NestMiddleware } from '@nestjs/common';
import { CorrelationService } from './correlation.service';
interface Response{setHeader(name:string,value:string):void}type NextFunction=()=>void;
@Injectable()
export class RequestCorrelationMiddleware implements NestMiddleware{
 constructor(private readonly correlation:CorrelationService){}
 use(_request:unknown,response:Response,next:NextFunction):void{this.correlation.runRequest(()=>{response.setHeader('x-request-id',this.correlation.current()!.request_id);next();});}
}
