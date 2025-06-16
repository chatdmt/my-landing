"use client";
import React, { useState, useEffect } from "react";

const steps = [
  { key: "name", placeholder: "name, please", type: "text", label: "Name" },
  { key: "email", placeholder: "now your email", type: "email", label: "Email" },
  { key: "source", placeholder: "how did you get here?", type: "text", label: "How did you get here?" },
  { key: "service", placeholder: "how can we serve you?", type: "text", label: "How can we serve you?" },
];

function generateSessionId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 10)
  );
}

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

interface AnimatedMultistepFormProps {
  onComplete: () => void;
  allowFinalExit?: boolean;
}

export default function AnimatedMultistepForm({ onComplete, allowFinalExit = false }: AnimatedMultistepFormProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<{ [key: string]: string }>({ name: "", email: "", source: "", service: "" });
  const [outgoing, setOutgoing] = useState<null | { step: number; value: string }>(null);
  const [animating, setAnimating] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [awaitingFinalExit, setAwaitingFinalExit] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    setSessionId(generateSessionId());
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [steps[step].key]: e.target.value });
    if (steps[step].key === 'email' && emailError) {
      setEmailError(null);
    }
  };

  const sendToFormspree = async (fieldKey: string, value: string) => {
    const data = {
      session_id: sessionId,
      field: fieldKey,
      label: steps.find((s) => s.key === fieldKey)?.label || fieldKey,
      value,
    };
    await fetch("https://formspree.io/f/xeokkapo", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && form[steps[step].key].trim() !== "" && !animating) {
      if (steps[step].key === 'email') {
        if (!isValidEmail(form.email)) {
          setEmailError("are you sure that's it?");
          return;
        }
      }
      setEmailError(null);
      const isFinalStep = step === steps.length - 1;
      if (isFinalStep) {
        await sendToFormspree(steps[step].key, form[steps[step].key]);
        setAwaitingFinalExit(true);
        onComplete();
      } else {
        setOutgoing({ step, value: form[steps[step].key] });
        setAnimating(true);
        await sendToFormspree(steps[step].key, form[steps[step].key]);
        setTimeout(() => {
          setStep((prev) => prev + 1);
          setOutgoing(null);
          setAnimating(false);
        }, 600);
      }
    }
  };

  useEffect(() => {
    if (awaitingFinalExit && allowFinalExit && !animating) {
      if (step >= steps.length) {
        // safety guard
        setAwaitingFinalExit(false);
        return;
      }
      const currentStepIdx = step;
      setOutgoing({ step: currentStepIdx, value: form[steps[currentStepIdx].key] });
      setAnimating(true);
      setTimeout(() => {
        setStep((prev) => prev + 1);
        setOutgoing(null);
        setAnimating(false);
        setAwaitingFinalExit(false);
      }, 600);
    }
  }, [allowFinalExit, awaitingFinalExit, animating, step, form]);

  const nextStep = outgoing ? outgoing.step + 1 : null;

  return (
    <div className="relative flex flex-col items-center w-full max-w-md mx-auto mt-32 md:mt-56">
      <div className="input-stack relative w-full h-16 flex items-center justify-center">
        {/* Outgoing field (flies out) */}
        {animating && outgoing && (
          <input
            className="animated-input fly-out-smooth w-full text-lg px-6 py-3 rounded-full bg-transparent text-white border-none focus:outline-none text-center"
            type={steps[outgoing.step].type}
            placeholder={steps[outgoing.step].placeholder}
            value={outgoing.value}
            disabled
            readOnly
          />
        )}
        {/* Incoming field (flies in) - only if next step exists */}
        {animating && nextStep !== null && nextStep < steps.length && (
          <input
            className="animated-input fly-in-smooth w-full text-lg px-6 py-3 rounded-full bg-transparent text-white border-none focus:outline-none text-center"
            type={steps[nextStep].type}
            placeholder={steps[nextStep].placeholder}
            value={form[steps[nextStep].key]}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        )}
        {/* First field (fade in) or current field (static) */}
        {!animating && step < steps.length && (
          <input
            className={`animated-input w-full text-lg px-6 py-3 rounded-full bg-transparent text-white border-none focus:outline-none text-center${step === 0 ? ' fade-in' : ''}`}
            type={steps[step].type}
            placeholder={steps[step].placeholder}
            value={form[steps[step].key]}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        )}
      </div>
      {emailError && (
        <p className="text-gray-400 text-center mt-2 h-6">{emailError}</p>
      )}
      {!emailError && <div className="h-8" />}
      <style jsx>{`
        .animated-input {
          transition: background 0.2s, transform 0.6s cubic-bezier(0.77,0,0.175,1), opacity 0.6s cubic-bezier(0.77,0,0.175,1);
          opacity: 1;
          position: absolute;
          left: 0;
          right: 0;
          box-shadow: none;
        }
        .animated-input:focus {
          outline: none;
          box-shadow: none;
          border-color: #52525b;
        }
        .fade-in {
          animation: fadeIn 0.7s cubic-bezier(0.77,0,0.175,1) forwards;
          opacity: 0;
          z-index: 2;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .fly-out-smooth {
          animation: flyOutRight 0.6s cubic-bezier(0.77,0,0.175,1) forwards;
          z-index: 1;
        }
        .fly-in-smooth {
          animation: flyInLeftToCenter 0.6s cubic-bezier(0.77,0,0.175,1) forwards;
          z-index: 2;
        }
        @keyframes flyOutRight {
          from { transform: translateX(0) scale(1); opacity: 1; }
          to { transform: translateX(100vw) scale(0.95); opacity: 0; }
        }
        @keyframes flyInLeftToCenter {
          from { transform: translateX(-100vw) scale(0.95); opacity: 0; }
          to { transform: translateX(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
} 