export class NextResponse extends Response {
  static json(body, init) { return new NextResponse(JSON.stringify(body), { ...init, headers: { "content-type": "application/json" } }); }
}
