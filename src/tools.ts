// src/tools.ts
// Clean, working barrel for your REPL
// Tools are already instantiated in your project, so we import them directly

import { FileReadTool } from './tools/FileReadTool/FileReadTool.js';
import { FileWriteTool } from './tools/FileWriteTool/FileWriteTool.js';
import { FileEditTool } from './tools/FileEditTool/FileEditTool.js';
import { BashTool } from './tools/BashTool/BashTool.js';
import { WebFetchTool } from './tools/WebFetchTool/WebFetchTool.js';
import { TodoWriteTool } from './tools/TodoWriteTool/TodoWriteTool.js';
import { WebSearchTool } from './tools/WebSearchTool/WebSearchTool.js';
import { ReadMcpResourceTool } from './tools/ReadMcpResourceTool/ReadMcpResourceTool.js';
import { GlobTool } from './tools/GlobTool/GlobTool.js'

// List of available tools (already instantiated)
const existingTools = [
  FileReadTool,
  FileWriteTool,
  FileEditTool,
  BashTool,
  WebFetchTool,
  TodoWriteTool,
  WebSearchTool,
  ReadMcpResourceTool,
  GlobTool,
].filter(Boolean);

export function getAllBaseTools() {
  return [...existingTools];
}

export function getTools() {
  return getAllBaseTools();
}

// Dummy exports to prevent "export not found" errors from REPL and other files
export const ALL_AGENT_DISALLOWED_TOOLS = [];
export const CUSTOM_AGENT_DISALLOWED_TOOLS = [];
export const ASYNC_AGENT_ALLOWED_TOOLS = [];
export const COORDINATOR_MODE_ALLOWED_TOOLS = [];

export function parseToolPreset(preset: string): string | null {
  return preset.toLowerCase() || null;
}

export function getToolsForDefaultPreset(): string[] {
  return getAllBaseTools().map(t => t.name || 'unknown');
}

export function assembleToolPool(permissionContext: any, mcpTools: any[]) {
  return [...getAllBaseTools(), ...mcpTools];
}

export function getMergedTools(permissionContext: any, mcpTools: any[]) {
  return [...getAllBaseTools(), ...mcpTools];
}

// Default export
export default {
  getAllBaseTools,
  getTools,
  ALL_AGENT_DISALLOWED_TOOLS,
  CUSTOM_AGENT_DISALLOWED_TOOLS,
  ASYNC_AGENT_ALLOWED_TOOLS,
  COORDINATOR_MODE_ALLOWED_TOOLS,
  parseToolPreset,
  getToolsForDefaultPreset,
  assembleToolPool,
  getMergedTools,
};
