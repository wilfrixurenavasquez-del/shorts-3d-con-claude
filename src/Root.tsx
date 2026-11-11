// Lista de vídeos del proyecto. Para un vídeo nuevo, Claude añade aquí su <Composition>.
import React from "react";
import { Composition, Still } from "remotion";
import { Abs, duracionAbs, FPS_ABS, PortadaAbs } from "./Abs";

export const Root: React.FC = () => (
  <>
    <Composition id="Abs" component={Abs} width={1080} height={1920} fps={FPS_ABS} durationInFrames={duracionAbs} />
    <Still id="PortadaAbs" component={PortadaAbs} width={1080} height={1920} />
  </>
);
