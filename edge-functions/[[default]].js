export default function onRequest() {
  return new Response("Building...", {headers: {"Content-Type": "text/plain"}});
}
