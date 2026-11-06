export interface AsciicastTheme {
  fg?: string;
  bg?: string;
  palette?: string;
}

export interface AsciicastHeader {
  version: number;
  width: number;
  height: number;
  timestamp?: number;
  title?: string;
  theme?: AsciicastTheme;
  idle_time_limit?: number;
  command?: string;
  env?: Record<string, string>;
  [key: string]: unknown;
}

export type AsciicastEventType = 'o' | 'i' | 'r';

export interface AsciicastEvent {
  time: number;
  type: AsciicastEventType;
  data: string;
}

export interface AsciicastRecording {
  header: AsciicastHeader;
  events: AsciicastEvent[];
  duration: number;
}
