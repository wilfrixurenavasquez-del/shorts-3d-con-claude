// Configuración de Remotion (cómo se exporta el vídeo).
import { Config } from "@remotion/cli/config";

Config.setEntryPoint("src/index.ts");
Config.setVideoImageFormat("jpeg");
Config.setCodec("h264"); // .mp4 compatible con TikTok, Reels y Shorts
Config.setOverwriteOutput(true);
