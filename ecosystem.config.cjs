module.exports = {
  apps: [
    {
      name: "green-app",
      cwd: "/home/senuser/green-app",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      env: {
        NODE_ENV: "production",
        ALLOWED_DOMAINS: "netzero.sen.go.kr",
        APP_ORIGIN: "https://netzero.sen.go.kr",
      },
    },
  ],
};
