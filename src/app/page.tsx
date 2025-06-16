"use client";
import React, { useState, useRef } from "react";
import ParticleTypography from "@/components/ui/interactive-particle-typography-1";
import AnimatedMultistepForm from "@/components/ui/animated-multistep-form";

export default function Home() {
  const [animationText, setAnimationText] = useState("let's chat");
  const [showForm, setShowForm] = useState(false);
  const [allowFinalExit, setAllowFinalExit] = useState(false);
  const animationTextRef = useRef(animationText);

  // Called when particle animation loop is active
  const handleAnimationReady = () => {
    setShowForm(true);
  };

  // Ensure the text changes as soon as the last field is submitted
  const handleFormComplete = () => {
    setAnimationText("received");
    animationTextRef.current = "received";
    // Give the particle component a tiny moment to start morphing, then allow final exit
    setTimeout(() => {
      setAllowFinalExit(true);
    }, 100);
  };

  return (
    <div className="flex flex-col w-full h-screen justify-start items-center relative pt-20">
      <div className="absolute inset-0 z-0">
        <ParticleTypography text={animationText} onReady={handleAnimationReady} />
      </div>
      {showForm && (
        <div className="relative z-10 w-full flex flex-col items-center justify-center">
          <AnimatedMultistepForm onComplete={handleFormComplete} allowFinalExit={allowFinalExit} />
        </div>
      )}
    </div>
  );
}
