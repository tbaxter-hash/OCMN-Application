export type AnswerValue = string | string[] | number;
export type Answers = Record<string, AnswerValue>;

export type QuestionType = "text" | "long" | "radio" | "multi" | "scale" | "note";
export type TextInputType = "email" | "tel" | "date" | "number";

export interface Question {
  id: string;
  t: QuestionType;
  l: string;
  h?: string;
  req?: 1;
  o?: string[];
  it?: TextInputType;
  ph?: string;
  low?: string;
  high?: string;
  w?: (answers: Answers) => boolean;
}

export interface Step {
  id: string;
  group: string;
  label: string;
  eyebrow: string;
  title: string;
  intro: string;
  notice?: string;
  w?: (answers: Answers) => boolean;
  qs: Question[];
}

export interface Path {
  id: string;
  title: string;
  desc: string;
}

export type Screen = "welcome" | "form" | "done";

export interface AppState {
  answers: Answers;
  screen: Screen;
  idx: number;
  showErr: boolean;
  forced: boolean;
  saveNote: string;
}
