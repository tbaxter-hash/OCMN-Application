"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { missingRequired, outstanding, visibleSteps } from "@/lib/derived";
import { clearSaved, getSavedSnapshot, getServerSavedSnapshot, persist, subscribeSaved } from "@/lib/storage";
import type { AnswerValue, Answers, Screen } from "@/lib/types";
import WelcomeScreen from "./WelcomeScreen";
import Sidebar from "./Sidebar";
import FormScreen from "./FormScreen";
import ReviewScreen from "./ReviewScreen";
import ConfirmationScreen from "./ConfirmationScreen";
import styles from "./PlanterApp.module.css";

export default function PlanterApp() {
  const [answers, setAnswers] = useState<Answers>({});
  const [screen, setScreen] = useState<Screen>("welcome");
  const [idx, setIdx] = useState(0);
  const [showErr, setShowErr] = useState(false);
  const [forced, setForced] = useState(false);
  const [saveNote, setSaveNote] = useState("");

  const savedState = useSyncExternalStore(subscribeSaved, getSavedSnapshot, getServerSavedSnapshot);

  useEffect(() => {
    if (screen === "form") window.scrollTo(0, 0);
  }, [idx, screen]);

  const steps = visibleSteps(answers);
  const boundedIdx = Math.min(idx, Math.max(steps.length - 1, 0));
  const currentStep = steps[boundedIdx];

  const selectPath = useCallback((pathId: string) => {
    setAnswers({ path: pathId });
    setIdx(0);
    setShowErr(false);
    setForced(false);
    setSaveNote("");
    setScreen("form");
  }, []);

  const resume = useCallback(() => {
    if (!savedState) return;
    const nextSteps = visibleSteps(savedState.answers);
    setAnswers(savedState.answers);
    setIdx(Math.min(savedState.idx, Math.max(nextSteps.length - 1, 0)));
    setSaveNote(savedState.savedAt);
    setShowErr(false);
    setForced(false);
    setScreen("form");
  }, [savedState]);

  const goWelcome = useCallback(() => {
    setScreen("welcome");
  }, []);

  const jump = useCallback(
    (nextIdx: number) => {
      setIdx(nextIdx);
      setShowErr(false);
      setForced(false);
      setSaveNote(persist(answers, nextIdx));
    },
    [answers],
  );

  const onAnswer = useCallback(
    (id: string, value: AnswerValue) => {
      const next = { ...answers, [id]: value };
      setAnswers(next);
      setSaveNote(persist(next, idx));
    },
    [answers, idx],
  );

  const goNext = useCallback(() => {
    const nextIdx = Math.min(boundedIdx + 1, steps.length - 1);
    setIdx(nextIdx);
    setShowErr(false);
    setForced(false);
    setSaveNote(persist(answers, nextIdx));
  }, [boundedIdx, steps.length, answers]);

  const back = useCallback(() => {
    if (boundedIdx === 0) {
      setScreen("welcome");
      return;
    }
    setIdx(boundedIdx - 1);
    setShowErr(false);
    setForced(false);
  }, [boundedIdx]);

  const continueStep = useCallback(() => {
    if (!currentStep) return;
    const missing = missingRequired(currentStep, answers);
    if (missing.length === 0 || forced) {
      goNext();
      return;
    }
    setShowErr(true);
    setForced(true);
  }, [currentStep, answers, forced, goNext]);

  const submit = useCallback(() => {
    clearSaved();
    setScreen("done");
  }, []);

  const backToStart = useCallback(() => {
    setAnswers({});
    setIdx(0);
    setShowErr(false);
    setForced(false);
    setScreen("welcome");
  }, []);

  if (screen === "welcome") {
    return (
      <WelcomeScreen
        firstName={typeof savedState?.answers.first === "string" ? savedState.answers.first : undefined}
        savedAt={savedState?.savedAt}
        hasSaved={!!savedState}
        onSelectPath={selectPath}
        onResume={resume}
      />
    );
  }

  if (screen === "done") {
    return (
      <ConfirmationScreen
        firstName={typeof answers.first === "string" ? answers.first : undefined}
        email={typeof answers.email === "string" ? answers.email : undefined}
        onBackToStart={backToStart}
      />
    );
  }

  if (!currentStep) return null;

  const missing = missingRequired(currentStep, answers);

  return (
    <div className={styles.layout}>
      <Sidebar steps={steps} currentIdx={boundedIdx} answers={answers} onJump={jump} onGoWelcome={goWelcome} />
      {currentStep.id === "review" ? (
        <ReviewScreen
          steps={steps}
          stepIndex={boundedIdx}
          totalSteps={steps.length}
          answers={answers}
          onEdit={jump}
          onGoFirstIncomplete={() => {
            const items = outstanding(answers);
            if (items.length) jump(items[0].stepIndex);
          }}
          onSubmit={submit}
        />
      ) : (
        <FormScreen
          step={currentStep}
          stepIndex={boundedIdx}
          totalSteps={steps.length}
          answers={answers}
          showErr={showErr}
          forced={forced}
          missing={missing}
          saveNote={saveNote}
          onAnswer={onAnswer}
          onBack={back}
          onContinue={continueStep}
          onSkip={goNext}
        />
      )}
    </div>
  );
}
