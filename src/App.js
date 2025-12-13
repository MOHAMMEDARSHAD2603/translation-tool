import React, { useState } from "react";
import { LANGUAGES } from "./languages";
import "./App.css";

// Public provider: MyMemory
const MYMEMORY_URL = "https://api.mymemory.translated.net/get";

// Optional spot for special-case mappings if needed later
const normalizeLang = (code) => code;

export default function App() {
  const [text, setText] = useState("");
  const [fromLang, setFromLang] = useState("en"); // explicit default
  const [toLang, setToLang] = useState("hi");
  const [translated, setTranslated] = useState("");
  const [provider, setProvider] = useState("");
  const [detected, setDetected] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ History state (load from localStorage initially)
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem("translationHistory");
    return saved ? JSON.parse(saved) : [];
  });

  const swapLanguages = () => {
    setFromLang(toLang);
    setToLang(fromLang);
    setTranslated("");
    setError("");
  };

  const saveToHistory = (input, output, from, to) => {
    const entry = {
      input,
      output,
      from,
      to,
      timestamp: new Date().toLocaleString()
    };
    const updated = [entry, ...history].slice(0, 10); // keep last 10
    setHistory(updated);
    localStorage.setItem("translationHistory", JSON.stringify(updated));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("translationHistory");
  };

  const downloadHistory = () => {
    if (history.length === 0) {
      alert("No history to download.");
      return;
    }

    let content = "Translation History\n\n";
    history.forEach((h, i) => {
      content += `${i + 1}. ${h.input} → ${h.output} (${h.from} → ${h.to}, ${h.timestamp})\n`;
    });

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "translation_history.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const translateText = async () => {
    setError("");
    setTranslated("");
    if (!text.trim()) {
      setError("Please enter text to translate.");
      return;
    }
    if (fromLang === toLang) {
      setError("Source and target languages are the same. Choose a different target.");
      return;
    }

    setLoading(true);
    try {
      const src = normalizeLang(fromLang);
      const tgt = normalizeLang(toLang);
      const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=${src}|${tgt}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json();
      const output = data?.responseData?.translatedText || "";
      if (!output) throw new Error("Empty translation");

      setTranslated(output);
      setProvider("MyMemory");

      // If auto detect chosen, show detected language from matches
      if (fromLang === "auto" && data?.matches?.length > 0) {
        const detectedLang = data.matches[0]?.source || "";
        setDetected(detectedLang);
      } else {
        setDetected("");
      }

      // ✅ Save to history
      saveToHistory(text, output, src, tgt);
    } catch (e) {
      console.error("Translation error:", e);
      setError("Translation failed. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  const copyTranslated = async () => {
    if (!translated) return;
    try {
      await navigator.clipboard.writeText(translated);
      alert("Copied translated text to clipboard.");
    } catch {
      alert("Copy failed. Please select the text and copy manually.");
    }
  };

  const copyBoth = async () => {
    if (!text || !translated) return;
    const combined = `Original (${fromLang}): ${text}\nTranslated (${toLang}): ${translated}`;
    try {
      await navigator.clipboard.writeText(combined);
      alert("Copied original + translated text.");
    } catch {
      alert("Copy failed. Please select manually.");
    }
  };

  const speakTranslated = () => {
    if (!translated) return;
    const utterance = new SpeechSynthesisUtterance(translated);
    // Basic mapping for Chinese; extend if you add more locales
    utterance.lang = toLang === "zh" ? "zh-CN" : toLang;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  // 🎤 Speech-to-text input
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = fromLang; // listen in source language
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;
      setText(spokenText);       // put recognized text in textarea
      translateText();           // auto‑translate it
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      alert("Speech recognition failed. Try again.");
    };

    recognition.start();
  };

  // 📲 Share translation
  const shareTranslation = () => {
    if (!translated) return;
    const message = encodeURIComponent(`Original (${fromLang}): ${text}\nTranslated (${toLang}): ${translated}`);
    const whatsappUrl = `https://wa.me/?text=${message}`;
    const telegramUrl = `https://t.me/share/url?url=&text=${message}`;
    // For demo: open WhatsApp by default
    window.open(whatsappUrl, "_blank");
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Language Translation Tool</h1>
        <p>Translate text instantly using a public translation API</p>
      </header>

      <div className="panel">
        <div className="row">
          <div className="col">
            <label>Source language</label>
            <select value={fromLang} onChange={(e) => setFromLang(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>

          <button className="swap" onClick={swapLanguages} title="Swap languages">⇄</button>

          <div className="col">
            <label>Target language</label>
            <select value={toLang} onChange={(e) => setToLang(e.target.value)}>
              {LANGUAGES.filter((l) => l.code !== "auto").map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>

        <label>Enter text</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste text here…"
          rows={6}
        />

        <div className="actions">
          <button onClick={translateText} disabled={loading}>
            {loading ? (
              <>
                Translating…
                <span className="spinner"></span>
              </>
            ) : "Translate"}
          </button>
          <button onClick={() => { setText(""); setTranslated(""); setError(""); }}>
            Clear
          </button>
          <button onClick={startListening}>🎤 Speak</button>
        </div>

        {error && <div className="error">{error}</div>}

        {/* ✅ Side-by-side bilingual view */}
        <div className="bilingual-view">
          <div className="col">
            <h3>Original ({fromLang})</h3>
            <div className="result">{text || "—"}</div>
          </div>
          <div className="col">
            <h3>Translated ({toLang})</h3>
            <div className="result">{translated || "—"}</div>
          </div>
        </div>

               <div className="output">
          <div className="output-header">
            <h3>Translated text</h3>
            <div className="output-actions">
              <button onClick={copyTranslated} disabled={!translated}>Copy</button>
              <button onClick={copyBoth} disabled={!translated}>Copy Both</button>
              <button onClick={speakTranslated} disabled={!translated}>Speak</button>
              <button onClick={shareTranslation} disabled={!translated}>Share</button>
            </div>
          </div>

          <div className="result">{translated || "—"}</div>

          <div className="meta">
            {provider && <small>Powered by: {provider}</small>}
            {detected && fromLang === "auto" && (
              <small>Detected language: {detected}</small>
            )}
          </div>
        </div>

        {/* ✅ History Panel */}
        <div className="history">
          <h3>Recent Translations</h3>
          {history.length === 0 ? (
            <p className="muted">No history yet.</p>
          ) : (
            <ul>
              {history.map((h, i) => (
                <li key={i}>
                  <strong>{h.input}</strong> → {h.output}
                  <small> ({h.from} → {h.to}, {h.timestamp})</small>
                </li>
              ))}
            </ul>
          )}
          {history.length > 0 && (
            <div className="history-actions">
              <button className="clear-history" onClick={clearHistory}>Clear History</button>
              <button className="download-history" onClick={downloadHistory}>Download History</button>
            </div>
          )}
        </div>
      </div>

      <footer className="footer">
        <small>Built for CodeAlpha Internship — Mohammed Arshad❤️ • Public translation API</small>
      </footer>
    </div>
  );
}