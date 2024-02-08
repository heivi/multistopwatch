module.exports = {
	apps : [{
	  name   : "multistopwatch",
	  script : "./server.js",
	  env: {
	  "NODE_ENV": "production",
	  "PORT": 3030,
	  }
	}]
  }
  