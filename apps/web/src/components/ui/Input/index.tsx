"use client";

import type { FieldErrors, UseFormRegisterReturn } from "react-hook-form";

import Error from "../Error";
import styles from "./styles.module.scss";

export type InputTypes = {
  label?: string;
  mode?: "light" | "dark";
  register: UseFormRegisterReturn;
  errors: FieldErrors | string;
  textarea?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement> &
  React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export default function Input({
  label,
  mode = "light",
  register,
  errors,
  textarea = false,
  ...props
}: InputTypes) {
  const handleExpand = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    // Use requestAnimationFrame to avoid forced reflow
    requestAnimationFrame(() => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight + 2}px`;
    });
  };

  const errorMessage =
    typeof errors === "string"
      ? errors
      : (errors[register.name]?.message as string);
  return (
    <label
      className={styles.input}
      aria-invalid={!!errorMessage}
      data-mode={mode}
    >
      {label && <span className={styles.label}>{label}</span>}
      {textarea ? (
        <textarea {...register} {...props} onInput={handleExpand} />
      ) : (
        <input {...register} {...props} />
      )}

      <Error withIcon={textarea}>{errorMessage}</Error>
    </label>
  );
}
