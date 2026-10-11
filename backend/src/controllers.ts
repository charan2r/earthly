import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { Connection } from "mongoose";
import { GrassQuestService, publicUser } from "./domain";
import { STORE, type Store } from "./store";
import { PLACES, type PlaceDiscovery } from "./providers";
import { SessionGuard, type AuthRequest } from "./http";
import {
  CreateUserDto,
  SettingsDto,
  QuestDto,
  PlacesDto,
  ProgressDto,
  ObservationDto,
  VoiceDto,
} from "./dto";
@Controller()
export class PublicController {
  constructor(
    @Inject(GrassQuestService) private service: GrassQuestService,
    @Inject(ConfigService) private config: ConfigService,
  ) {}
  @Get("health") health() {
    return {
      status: "ok",
      database: "connected",
      ai: !!this.config.get("GEMMA_API_KEY"),
      voice: !!(
        this.config.get("ELEVENLABS_API_KEY") &&
        this.config.get("ELEVENLABS_VOICE_ID")
      ),
      discovery: !!this.config.get("SERPAPI_API_KEY"),
    };
  }
  @Post("users/session")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  session(@Body() dto: CreateUserDto) {
    return this.service.session(dto.name);
  }
}
@Controller()
@UseGuards(SessionGuard)
export class QuestController {
  constructor(
    @Inject(GrassQuestService) private service: GrassQuestService,
    @Inject(STORE) private store: Store,
    @Inject(PLACES) private places: PlaceDiscovery,
  ) {}
  @Get("users/me") async me(@Req() req: AuthRequest) {
    return publicUser(await this.store.user(req.userId));
  }
  @Patch("users/me") async settings(
    @Req() req: AuthRequest,
    @Body() dto: SettingsDto,
  ) {
    return publicUser(await this.store.updateUser(req.userId, dto));
  }
  @Get("quests") list(@Req() req: AuthRequest) {
    return this.store.quests(req.userId);
  }
  @Post("quests") @Throttle({ default: { limit: 5, ttl: 60000 } }) create(
    @Req() req: AuthRequest,
    @Body() dto: QuestDto,
  ) {
    return this.service.create(req.userId, dto);
  }
  @Get("quests/:id") quest(
    @Req() req: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.store.quest(id, req.userId);
  }
  @Patch("quests/:id/progress") progress(
    @Req() req: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: ProgressDto,
  ) {
    return this.service.progress(req.userId, id, dto);
  }
  @Post("places/discover") discover(@Body() dto: PlacesDto) {
    return this.places.discover(dto.location, dto.latitude, dto.longitude);
  }
  @Get("quests/:id/observations") observations(
    @Req() req: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.store
      .quest(id, req.userId)
      .then(() => this.store.observations(id, req.userId));
  }
  @Post("quests/:id/observations")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor("photo", {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2, parts: 3 },
    }),
  )
  observe(
    @Req() req: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: ObservationDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.observe(req.userId, id, dto, file);
  }
  @Post("quests/:id/voice")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async voice(
    @Req() req: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: VoiceDto,
    @Res() res: Response,
  ) {
    const audio = await this.service.speak(req.userId, id, dto.step);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(audio);
  }
}
