import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { json } from "express";
import { AppModule } from "./app.module";
import { ApiErrorFilter, RequestLogger } from "./http";

export async function createApp() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const c = app.get(ConfigService);
  app.use(helmet());
  app.use(json({ limit: "32kb" }));
  app.setGlobalPrefix("api/v1");
  const webOrigin = c.get<string>("WEB_ORIGIN");
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || origin === webOrigin) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' is not allowed`));
      }
    },
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new ApiErrorFilter());
  app.useGlobalInterceptors(new RequestLogger());
  app.enableShutdownHooks();
  return app;
}
if (require.main === module) {
  createApp()
    .then(async (app) => {
      const c = app.get(ConfigService);
      await app.listen(c.get<number>("PORT")!);
      new Logger("Earthly").log(
        `Ready on port ${c.get("PORT")} (Live MongoDB connected)`,
      );
    })
    .catch((err) => {
      new Logger("Bootstrap").error(
        `Startup failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    });
}
