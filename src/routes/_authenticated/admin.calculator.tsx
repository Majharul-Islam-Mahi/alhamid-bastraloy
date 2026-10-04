// src/routes/_authenticated/admin.calculator.tsx
// সুন্দর ক্যালকুলেটর — basic + % সহ
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Calculator, RotateCcw, Delete, History } from "lucide-react";
import { toBnDigits, toEnDigits } from "@/lib/shop";

export const Route = createFileRoute("/_authenticated/admin/calculator")({
  head: () => ({ meta: [{ title: "ক্যালকুলেটর — আল হামিদ বস্ত্রালয়" }] }),
  component: CalculatorPage,
});

function CalculatorPage() {
  const [display, setDisplay] = useState("0");
  const [previous, setPrevious] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [memory, setMemory] = useState<number>(0);
  const [history, setHistory] = useState<string[]>([]);
  const [isBangla, setIsBangla] = useState(true);

  // কীবোর্ড সাপোর্ট
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (/^[0-9]$/.test(e.key)) inputDigit(e.key);
      else if (e.key === ".") inputDot();
      else if (["+", "-", "*", "/"].includes(e.key)) performOp(e.key);
      else if (e.key === "Enter" || e.key === "=") performEqual();
      else if (e.key === "Backspace") backspace();
      else if (e.key === "Escape") clearAll();
      else if (e.key === "%") performPercent();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  function inputDigit(d: string) {
    if (waitingForOperand) {
      setDisplay(d);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === "0" ? d : display + d);
    }
  }

  function inputDot() {
    if (waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes(".")) setDisplay(display + ".");
  }

  function performOp(op: string) {
    const value = parseFloat(display);
    if (previous !== null && operator && !waitingForOperand) {
      const result = calculate(previous, value, operator);
      setDisplay(formatNumber(result));
      setPrevious(result);
      setHistory((h) => [
        `${formatNumber(previous)} ${opSymbol(operator)} ${formatNumber(value)} = ${formatNumber(result)}`,
        ...h.slice(0, 19),
      ]);
    } else {
      setPrevious(value);
    }
    setOperator(op);
    setWaitingForOperand(true);
  }

  function performEqual() {
    if (previous === null || !operator) return;
    const value = parseFloat(display);
    const result = calculate(previous, value, operator);
    setHistory((h) => [
      `${formatNumber(previous)} ${opSymbol(operator)} ${formatNumber(value)} = ${formatNumber(result)}`,
      ...h.slice(0, 19),
    ]);
    setDisplay(formatNumber(result));
    setPrevious(null);
    setOperator(null);
    setWaitingForOperand(true);
  }

  function performPercent() {
    const value = parseFloat(display);
    const pct = previous !== null ? (previous * value) / 100 : value / 100;
    setDisplay(formatNumber(pct));
    setWaitingForOperand(true);
  }

  function backspace() {
    if (waitingForOperand) return;
    setDisplay(display.length <= 1 ? "0" : display.slice(0, -1));
  }

  function clearAll() {
    setDisplay("0");
    setPrevious(null);
    setOperator(null);
    setWaitingForOperand(false);
  }

  function calculate(a: number, b: number, op: string): number {
    switch (op) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "*":
        return a * b;
      case "/":
        return b === 0 ? 0 : a / b;
      default:
        return b;
    }
  }

  function opSymbol(op: string) {
    return { "+": "+", "-": "−", "*": "×", "/": "÷" }[op] ?? op;
  }

  function formatNumber(n: number): string {
    if (!isFinite(n)) return "Error";
    // ২ দশমিক পর্যন্ত, তারপর zero বাদ
    const fixed = Math.round(n * 100) / 100;
    return String(fixed);
  }

  function displayBn(s: string): string {
    return isBangla ? toBnDigits(s) : s;
  }

  const displayValue = displayBn(display);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-7 w-7 text-primary" />
          <h1
            className="text-3xl"
            style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}
          >
            ক্যালকুলেটর
          </h1>
        </div>
        <button
          onClick={() => setIsBangla(!isBangla)}
          className="rounded-full border px-3 py-1 text-xs font-medium"
          style={{
            borderColor: "#c9924a",
            color: "#c9924a",
            backgroundColor: "rgba(201,146,74,0.1)",
          }}
        >
          {isBangla ? "০১২৩" : "0123"}
        </button>
      </div>

      {/* Main calculator */}
      <div
        className="rounded-3xl border-2 p-5 shadow-lg"
        style={{
          borderColor: "#dbcbb2",
          background: "linear-gradient(180deg, #fdfaf5 0%, #f5efe6 100%)",
        }}
      >
        {/* Display */}
        <div
          className="mb-4 rounded-2xl p-5"
          style={{
            background: "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)",
            minHeight: "110px",
          }}
        >
          {/* History line */}
          <p
            className="text-right text-sm"
            style={{ color: "#c9924a", minHeight: "20px" }}
          >
            {previous !== null && operator
              ? `${displayBn(String(previous))} ${opSymbol(operator)}`
              : "\u00A0"}
          </p>
          {/* Main display */}
          <p
            className="mt-2 break-all text-right text-4xl font-bold tabular-nums"
            style={{
              color: "#ffffff",
              fontFamily: isBangla ? "'Hind Siliguri', sans-serif" : "monospace",
              minHeight: "52px",
              lineHeight: "1.2",
            }}
          >
            {displayValue}
          </p>
          {/* Memory */}
          {memory !== 0 && (
            <p className="mt-1 text-right text-[10px]" style={{ color: "#c9924a" }}>
              M: {displayBn(String(memory))}
            </p>
          )}
        </div>

        {/* Buttons Grid */}
        <div className="grid grid-cols-4 gap-2">
          {/* Row 1: Clear, Backspace, %, ÷ */}
          <CalcBtn onClick={clearAll} variant="danger">
            AC
          </CalcBtn>
          <CalcBtn onClick={backspace} variant="secondary">
            <Delete className="mx-auto h-5 w-5" />
          </CalcBtn>
          <CalcBtn onClick={performPercent} variant="secondary">
            %
          </CalcBtn>
          <CalcBtn
            onClick={() => performOp("/")}
            variant="operator"
            active={operator === "/" && waitingForOperand}
          >
            ÷
          </CalcBtn>

          {/* Row 2: 7 8 9 × */}
          <CalcBtn onClick={() => inputDigit("7")}>
            {displayBn("7")}
          </CalcBtn>
          <CalcBtn onClick={() => inputDigit("8")}>
            {displayBn("8")}
          </CalcBtn>
          <CalcBtn onClick={() => inputDigit("9")}>
            {displayBn("9")}
          </CalcBtn>
          <CalcBtn
            onClick={() => performOp("*")}
            variant="operator"
            active={operator === "*" && waitingForOperand}
          >
            ×
          </CalcBtn>

          {/* Row 3: 4 5 6 − */}
          <CalcBtn onClick={() => inputDigit("4")}>
            {displayBn("4")}
          </CalcBtn>
          <CalcBtn onClick={() => inputDigit("5")}>
            {displayBn("5")}
          </CalcBtn>
          <CalcBtn onClick={() => inputDigit("6")}>
            {displayBn("6")}
          </CalcBtn>
          <CalcBtn
            onClick={() => performOp("-")}
            variant="operator"
            active={operator === "-" && waitingForOperand}
          >
            −
          </CalcBtn>

          {/* Row 4: 1 2 3 + */}
          <CalcBtn onClick={() => inputDigit("1")}>
            {displayBn("1")}
          </CalcBtn>
          <CalcBtn onClick={() => inputDigit("2")}>
            {displayBn("2")}
          </CalcBtn>
          <CalcBtn onClick={() => inputDigit("3")}>
            {displayBn("3")}
          </CalcBtn>
          <CalcBtn
            onClick={() => performOp("+")}
            variant="operator"
            active={operator === "+" && waitingForOperand}
          >
            +
          </CalcBtn>

          {/* Row 5: 00, 0, ., = */}
          <CalcBtn onClick={() => { inputDigit("0"); inputDigit("0"); }}>
            {displayBn("00")}
          </CalcBtn>
          <CalcBtn onClick={() => inputDigit("0")}>
            {displayBn("0")}
          </CalcBtn>
          <CalcBtn onClick={inputDot}>
            {isBangla ? "." : "."}
          </CalcBtn>
          <CalcBtn onClick={performEqual} variant="equal">
            =
          </CalcBtn>
        </div>

        {/* Memory row */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          <button
            onClick={() => setMemory(parseFloat(display))}
            className="rounded-lg border py-2 text-xs"
            style={{ borderColor: "#dbcbb2", color: "#3a2318" }}
          >
            M+
          </button>
          <button
            onClick={() => setDisplay(String(memory))}
            className="rounded-lg border py-2 text-xs"
            style={{ borderColor: "#dbcbb2", color: "#3a2318" }}
          >
            MR
          </button>
          <button
            onClick={() => setMemory(0)}
            className="rounded-lg border py-2 text-xs"
            style={{ borderColor: "#dbcbb2", color: "#3a2318" }}
          >
            MC
          </button>
          <button
            onClick={() => setHistory([])}
            className="rounded-lg border py-2 text-xs"
            style={{ borderColor: "#dbcbb2", color: "#3a2318" }}
          >
            <RotateCcw className="mx-auto h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h2
              className="text-lg"
              style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}
            >
              সাম্প্রতিক হিসাব
            </h2>
          </div>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {history.map((h, i) => (
              <li
                key={i}
                className="rounded-lg border-b py-1.5 text-right tabular-nums last:border-0"
                style={{
                  color: "#3a2318",
                  fontFamily: "'Hind Siliguri', sans-serif",
                }}
              >
                {isBangla ? toBnDigits(h) : h}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-center text-xs" style={{ color: "#7a6558" }}>
        কীবোর্ড দিয়েও কাজ করতে পারেন: 0-9, +, −, ×, ÷, Enter, Backspace, Esc
      </p>
    </div>
  );
}

// ==== Button component ====
function CalcBtn({
  onClick,
  children,
  variant = "number",
  active = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "number" | "operator" | "equal" | "secondary" | "danger";
  active?: boolean;
}) {
  const styleMap = {
    number: {
      bg: "#fdfaf5",
      color: "#3a2318",
      border: "#dbcbb2",
    },
    secondary: {
      bg: "#eadfcc",
      color: "#3a2318",
      border: "#dbcbb2",
    },
    danger: {
      bg: "#fee2e2",
      color: "#dc2626",
      border: "#fca5a5",
    },
    operator: {
      bg: active
        ? "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)"
        : "linear-gradient(135deg, #c9924a 0%, #b57f38 100%)",
      color: "#ffffff",
      border: "#c9924a",
    },
    equal: {
      bg: "linear-gradient(135deg, #2d7a4f 0%, #1e5c3a 100%)",
      color: "#ffffff",
      border: "#2d7a4f",
    },
  };

  const s = styleMap[variant];

  return (
    <button
      onClick={onClick}
      className="flex h-14 items-center justify-center rounded-xl text-xl font-semibold shadow-sm transition active:scale-95"
      style={{
        background: s.bg,
        color: s.color,
        border: `1.5px solid ${s.border}`,
      }}
    >
      {children}
    </button>
  );
}