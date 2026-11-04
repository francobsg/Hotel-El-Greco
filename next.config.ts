import type { NextConfig } from "next";

const configuracion: NextConfig = { agentRules: false, images: { localPatterns: [{ pathname: "/img/**" }] } };

export default configuracion;
