// Isolated, transport-neutral controller. Never import into production Worker/MCP.
// An external authenticated transport is intentionally NOT provided.
import {createLocalControllerAuth} from "./local-controller-auth.mjs";
export function createIsolatedBrowserController(session,{auth=createLocalControllerAuth()}={}){
 if(!session||typeof session.state!=="function"||typeof session.search!=="function"||typeof session.click!=="function"||typeof session.back!=="function")throw Error("Browser session required");
 let queue=Promise.resolve(),closed=false;
 const history=[];
 function read(token){
  if(closed||!auth.verify(token,"viewer:read"))throw Error("Unauthorized");
  return session.state();
 }
 async function execute(token,command){
  if(closed||!auth.verify(token,"viewer:control",{consume:true}))throw Error("Unauthorized or grant used");
  if(!command||typeof command!=="object"||Array.isArray(command))throw Error("Invalid command");
  const keys=Object.keys(command).sort().join(",");
  const action=async()=>{
   if(command.type==="search"&&keys==="term,type")await session.search(command.term);
   else if(command.type==="click"&&keys==="href,type")await session.click(command.href);
   else if(command.type==="back"&&keys==="type")await session.back();
   else throw Error("Command refused");
   const state=session.state();
   history.push({type:command.type,sequence:state.sequence,at:Date.now()});
   return state;
  };
  const result=queue.then(action);
  queue=result.then(()=>{},()=>{});
  return result;
 }
 return Object.freeze({
  issueReadGrant:()=>auth.issue({scope:"viewer:read",ttlMs:60000}),
  issueControlGrant:()=>auth.issue({scope:"viewer:control",ttlMs:30000}),
  read,execute,
  audit:()=>history.map(x=>({...x})),
  close:()=>{closed=true;}
 });
}
