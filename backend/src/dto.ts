import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
export class CreateUserDto {
  @IsString() @MinLength(1) @MaxLength(40) name!: string;
}
export class SettingsDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40) name?: string;
  @IsOptional() @IsBoolean() voice?: boolean;
  @IsOptional() @IsBoolean() reducedMotion?: boolean;
}
export class PlaceDto {
  @IsString() @MaxLength(200) id!: string;
  @IsString() @MinLength(1) @MaxLength(150) name!: string;
  @IsString() @MaxLength(300) address!: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(5) rating?: number;
  @IsIn(["serpapi", "manual"]) source!: "serpapi" | "manual";
}
export class QuestDto {
  @IsInt() @Min(15) @Max(120) minutes!: number;
  @IsIn(["peaceful", "curious", "energized"]) mood!:
    | "peaceful"
    | "curious"
    | "energized";
  @IsString() @MinLength(2) @MaxLength(120) location!: string;
  @IsIn(["standard", "step-free"]) mobility!: "standard" | "step-free";
  @IsIn(["solo", "together"]) company!: "solo" | "together";
  @IsOptional() @ValidateNested() @Type(() => PlaceDto) place?: PlaceDto;
}
export class PlacesDto {
  @IsString() @MinLength(2) @MaxLength(120) location!: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
export class ProgressDto {
  @IsIn(["ready", "active", "completed"]) status!:
    | "ready"
    | "active"
    | "completed";
  @IsArray()
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(7, { each: true })
  completedSteps!: number[];
  @IsArray()
  @ArrayMaxSize(9)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(8, { each: true })
  bingo!: number[];
  @IsInt() @Min(0) @Max(86400) screenSeconds!: number;
  @IsInt() @Min(0) @Max(86400) elapsedSeconds!: number;
}
export class ObservationDto {
  @IsUUID("4") id!: string;
  @IsString() @MaxLength(600) note!: string;
}
export class VoiceDto {
  @IsInt() @Min(0) @Max(7) step!: number;
}
