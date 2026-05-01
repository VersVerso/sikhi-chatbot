"use client";

import { FormEvent, useMemo, useState } from "react";

import styles from "./page.module.css";

type Mode = "quick" | "deep";
type Language = "de" | "en";

type Citation = {
  page: number;
  gurmukhiExcerpt: string;
  source: "SGGS_PDF" | "YOUTUBE";
};

type ChatApiResponse = {
  answer: string;
  citations: Citation[];
  confidence: number;
  needsClarification?: boolean;
  error?: string;
};

const labels = {
  de: {
    title: "Sikhi Lern-Chatbot (SGGS)",
    subtitle:
      "RAG über SGGS PDF. Antworten sind Erläuterung/Interpretation mit Gurmukhi-Zitat und Seitenzahl.",
    mode: "Modus",
    modeQuick: "Quick",
    modeDeep: "Deep",
    language: "Ausgabesprache",
    youtube: "YouTube-Quellen erlauben (optional, standardmäßig aus)",
    placeholder: "Frage zu einem Thema im SGGS stellen…",
    ask: "Frage senden",
    citing: "Quellen",
    confidence: "Retrieval-Konfidenz",
    hint: "Hinweis: Keine 1:1 Übersetzung — nur sinngemäße Erläuterung/Interpretation mit Kontext.",
  },
  en: {
    title: "Sikhi Learning Chatbot (SGGS)",
    subtitle:
      "RAG over SGGS PDF. Answers are Erläuterung/Interpretation with Gurmukhi quotes and page numbers.",
    mode: "Mode",
    modeQuick: "Quick",
    modeDeep: "Deep",
    language: "Output language",
    youtube: "Allow YouTube sources (optional, disabled by default)",
    placeholder: "Ask a question about a SGGS theme…",
    ask: "Send question",
    citing: "Sources",
    confidence: "Retrieval confidence",
    hint: "Note: No literal translation — contextual explanatory interpretation only.",
  },
};

export default function Home() {
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<Mode>("deep");
  const [language, setLanguage] = useState<Language>("de");
  const [allowYouTube, setAllowYouTube] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ChatApiResponse | null>(null);
  const [error, setError] = useState<string>("");

  const canUseYouTube = useMemo(
    () => process.env.NEXT_PUBLIC_ALLOW_YOUTUBE_SOURCES === "true",
    [],
  );

  const t = labels[language];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          mode,
          language,
          allowYouTube: canUseYouTube && allowYouTube,
        }),
      });

      const data = (await res.json()) as ChatApiResponse;
      if (!res.ok) {
        setError(data.error || "Request failed.");
        return;
      }

      setResponse(data);
    } catch {
      setError(language === "de" ? "Serverfehler bei der Anfrage." : "Server error while requesting.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.container}>
        <h1 className={styles.title}>{t.title}</h1>
        <p className={styles.subtitle}>{t.subtitle}</p>

        <form onSubmit={submit}>
          <div className={styles.controls}>
            <label className={styles.controlGroup}>
              <span>{t.mode}</span>
              <select className={styles.select} value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                <option value="quick">{t.modeQuick}</option>
                <option value="deep">{t.modeDeep}</option>
              </select>
            </label>

            <label className={styles.controlGroup}>
              <span>{t.language}</span>
              <select
                className={styles.select}
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
              >
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </label>

            <label className={styles.controlGroup}>
              <span>{t.youtube}</span>
              <input
                className={styles.input}
                type="checkbox"
                checked={allowYouTube}
                onChange={(e) => setAllowYouTube(e.target.checked)}
                disabled={!canUseYouTube}
              />
            </label>
          </div>

          <div className={styles.inputRow}>
            <input
              className={styles.input}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t.placeholder}
            />
            <button className={styles.button} type="submit" disabled={loading || !question.trim()}>
              {loading ? "…" : t.ask}
            </button>
          </div>
        </form>

        <p className={styles.hint}>{t.hint}</p>

        <section className={styles.chatPanel}>
          {response ? (
            <>
              <div className={styles.answer}>{response.answer}</div>
              <div>
                <strong>
                  {t.confidence}: {response.confidence}
                </strong>
              </div>
              <div className={styles.citations}>
                <strong>{t.citing}</strong>
                {response.citations.length > 0 ? (
                  response.citations.map((citation, index) => (
                    <article key={`${citation.page}-${index}`} className={styles.citation}>
                      <div>
                        <strong>Page:</strong> {citation.page}
                      </div>
                      <div>{citation.gurmukhiExcerpt}</div>
                    </article>
                  ))
                ) : (
                  <div>No citations returned.</div>
                )}
              </div>
            </>
          ) : (
            <div className={styles.footerNote}>Ask your first question to begin.</div>
          )}

          {error ? <div className={styles.error}>{error}</div> : null}
        </section>

        <p className={styles.footerNote}>
          SGGS source citations are mandatory. If confidence is low, the assistant asks for clarification.
        </p>
      </main>
    </div>
  );
}
