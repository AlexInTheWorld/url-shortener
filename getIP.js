function getIP(request) {
  var client = request.headers['x-forwarded-for'].split(",")[0];
  return client;
}

exports.getIP = getIP;