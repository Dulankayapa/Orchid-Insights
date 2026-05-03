import { useEffect, useState } from "react";
import { auth } from "../../lib/firebase";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000"
).replace(/\/$/, "");
const HISTORY_STORAGE_KEY = "orchid-care-quiz-history";
const QUIZ_ROUND_SIZE = 5;

const fallbackQuestions = [
  {
    id: "light-1",
    question: "What kind of light do most common indoor orchids prefer?",
    options: [
      "Bright, indirect light",
      "Full afternoon sun",
      "Complete shade",
      "Only artificial light",
    ],
    correct: 0,
  },
  {
    id: "water-1",
    question: "A healthy orchid root that needs water often looks:",
    options: ["Black and dry", "Silvery or pale", "Bright red", "Soft and mushy"],
    correct: 1,
  },
  {
    id: "mix-1",
    question: "Why are orchids usually planted in bark or chunky media instead of dense soil?",
    options: [
      "To hold as much water as possible",
      "To improve airflow around the roots",
      "To make the pot heavier",
      "To keep the plant colder",
    ],
    correct: 1,
  },
  {
    id: "leaf-1",
    question: "A single old lower leaf turning yellow is often:",
    options: [
      "Always a deadly disease",
      "Normal aging",
      "A sign the orchid needs freezing temperatures",
      "Proof the plant needs no more water",
    ],
    correct: 1,
  },
  {
    id: "water-2",
    question: "What is the best general watering rule for many orchids?",
    options: [
      "Water on a strict hourly schedule",
      "Keep the potting mix soggy at all times",
      "Water when the potting mix is close to dry",
      "Only water once per month no matter what",
    ],
    correct: 2,
  },
  {
    id: "temp-1",
    question: "What can happen if an orchid sits in a cold draft overnight?",
    options: [
      "It will always bloom faster",
      "It may become stressed or damaged",
      "Its roots will automatically dry out",
      "Nothing, orchids prefer sudden cold air",
    ],
    correct: 1,
  },
  {
    id: "pot-1",
    question: "A clear orchid pot is useful because it helps you:",
    options: [
      "Watch root health and moisture more easily",
      "Double the fertilizer strength safely",
      "Prevent all pests permanently",
      "Avoid repotting forever",
    ],
    correct: 0,
  },
  {
    id: "fert-1",
    question: "What is a safer fertilizer habit for many orchids?",
    options: [
      "Use a balanced fertilizer at a gentle dose",
      "Use only lawn fertilizer",
      "Add fertilizer every day",
      "Never feed during active growth",
    ],
    correct: 0,
  },
  {
    id: "root-2",
    question: "Mushy brown orchid roots usually suggest:",
    options: ["Healthy new growth", "Root rot", "Too much sunlight", "A need for more bark"],
    correct: 1,
  },
  {
    id: "repot-1",
    question: "When is repotting often a good idea?",
    options: [
      "When the potting mix has broken down and stays soggy",
      "Every single week",
      "Only when flowers are open",
      "Never, orchids should stay in one pot forever",
    ],
    correct: 0,
  },
  {
    id: "humidity-1",
    question: "Why do many orchids appreciate moderate humidity?",
    options: [
      "It supports healthier leaves and roots",
      "It replaces the need for watering",
      "It makes fertilizer unnecessary",
      "It guarantees nonstop blooming",
    ],
    correct: 0,
  },
];

function shuffleArray(items) {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[index]];
  }

  return nextItems;
}

function buildQuestionRound(questionPool, previousQuestionIds = []) {
  const shuffledPool = shuffleArray(questionPool);
  const previousQuestionIdSet = new Set(previousQuestionIds);
  const preferredQuestions = shuffledPool.filter((question) => !previousQuestionIdSet.has(question.id));
  const repeatedQuestions = shuffledPool.filter((question) => previousQuestionIdSet.has(question.id));

  if (questionPool.length <= QUIZ_ROUND_SIZE) {
    return shuffledPool;
  }

  return [...preferredQuestions, ...repeatedQuestions].slice(0, QUIZ_ROUND_SIZE);
}

function readStoredHistory() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Error reading quiz history:", error);
    return [];
  }
}

function writeStoredHistory(nextHistory) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
}

function normalizeHistoryAttempt(attempt) {
  return {
    id: attempt.id || crypto.randomUUID(),
    score: attempt.score ?? 0,
    total: attempt.total ?? QUIZ_ROUND_SIZE,
    completedAt: attempt.completedAt || attempt.completed_at || new Date().toISOString(),
  };
}

async function buildAuthHeaders() {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function QuizTile() {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState([]);
  const [lastRoundQuestionIds, setLastRoundQuestionIds] = useState([]);
  const [usesRemoteQuiz, setUsesRemoteQuiz] = useState(false);

  const fetchQuestions = async () => {
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/quiz/questions`, {
        headers: await buildAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Quiz question request failed with ${response.status}.`);
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Quiz question payload was empty.");
      }

      const nextRound = buildQuestionRound(data, lastRoundQuestionIds);
      setQuestions(nextRound);
      setLastRoundQuestionIds(nextRound.map((question) => question.id));
      setUsesRemoteQuiz(true);
      return;
    } catch (error) {
      console.warn("Falling back to built-in quiz questions:", error);
      const nextRound = buildQuestionRound(fallbackQuestions, lastRoundQuestionIds);
      setQuestions(nextRound);
      setLastRoundQuestionIds(nextRound.map((question) => question.id));
      setUsesRemoteQuiz(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/quiz/history`, {
        headers: await buildAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Quiz history request failed with ${response.status}.`);
      }

      const data = await response.json();
      setHistory(Array.isArray(data) ? data.map(normalizeHistoryAttempt) : []);
    } catch (error) {
      console.warn("Using local quiz history:", error);
      setHistory(readStoredHistory());
    }
  };

  useEffect(() => {
    void fetchQuestions();
    void fetchHistory();
  }, []);

  const saveScore = async (finalScore) => {
    const attempt = {
      id: crypto.randomUUID(),
      score: finalScore,
      total: questions.length,
      completedAt: new Date().toISOString(),
    };

    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/quiz/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await buildAuthHeaders()),
        },
        body: JSON.stringify({
          score: finalScore,
          total: questions.length,
          answers: [],
        }),
      });

      if (!response.ok) {
        throw new Error(`Quiz submit request failed with ${response.status}.`);
      }

      await fetchHistory();
    } catch (error) {
      console.warn("Saving quiz score locally:", error);
      const nextHistory = [attempt, ...readStoredHistory()].slice(0, 10);
      writeStoredHistory(nextHistory);
      setHistory(nextHistory);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswer = () => {
    if (selectedOption === null) {
      return;
    }

    const currentQuestion = questions[currentIndex];
    const isCorrect = selectedOption === currentQuestion.correct;
    const nextScore = isCorrect ? score + 1 : score;

    if (isCorrect) {
      setScore(nextScore);
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex < questions.length) {
      setCurrentIndex(nextIndex);
      setSelectedOption(null);
      return;
    }

    setShowResult(true);
    void saveScore(nextScore);
  };

  const resetQuiz = () => {
    setCurrentIndex(0);
    setScore(0);
    setSelectedOption(null);
    setShowResult(false);
    void fetchQuestions();
  };

  if (loading) {
    return (
      <section className="flex h-[700px] flex-col rounded-2xl border border-border/60 bg-paper/95 p-4 text-dark shadow-lg dark:shadow-[0_18px_40px_-24px_rgba(2,6,23,0.8)]">
        <h2 className="text-xl font-bold text-gray-900">Orchid Quiz</h2>
        <p className="mt-4 text-sm text-gray-500">Loading quiz...</p>
      </section>
    );
  }

  if (showResult) {
    const bestScore = history.length > 0 ? Math.max(...history.map((item) => item.score)) : 0;

    return (
      <section className="flex h-[700px] flex-col rounded-2xl border border-border/60 bg-paper/95 p-4 text-dark shadow-lg dark:shadow-[0_18px_40px_-24px_rgba(2,6,23,0.8)]">
        <header className="mb-4 min-h-[84px]">
          <h2 className="text-xl font-bold text-gray-900">Orchid Quiz</h2>
          <p className="text-sm text-gray-500">
            {usesRemoteQuiz
              ? "Scores can sync with the quiz API when it is available."
              : "This quiz is currently running with built-in questions and local history."}
          </p>
        </header>

        <div className="flex-1 flex flex-col justify-center rounded-2xl bg-green-50 border border-green-100 p-6 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-green-700">Quiz completed</p>
          <p className="mt-3 text-4xl font-bold text-green-700">
            {score} / {questions.length}
          </p>
          <p className="mt-2 text-sm text-gray-600">Best score: {bestScore} / {questions.length}</p>

          <button
            onClick={resetQuiz}
            className="mt-6 bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700"
          >
            Take Again
          </button>

          {submitting ? (
            <p className="mt-3 text-xs text-gray-400">Saving score...</p>
          ) : null}
        </div>

        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-700">Recent attempts</h3>
          {history.length === 0 ? (
            <p className="mt-2 text-sm text-gray-400">No saved attempts yet.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {history.slice(0, 3).map((attempt) => (
                <div
                  key={attempt.id || attempt.completedAt}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                >
                  <span>{new Date(attempt.completedAt || Date.now()).toLocaleDateString()}</span>
                  <span className="font-semibold text-gray-700">
                    {attempt.score}/{attempt.total || questions.length}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) {
    return null;
  }

  return (
    <section className="flex h-[700px] flex-col rounded-2xl border border-border/60 bg-paper/95 p-4 text-dark shadow-lg dark:shadow-[0_18px_40px_-24px_rgba(2,6,23,0.8)]">
      <header className="mb-4 min-h-[84px]">
        <h2 className="text-xl font-bold text-gray-900">Orchid Quiz</h2>
        <p className="text-sm text-gray-500">
          Test quick care knowledge with a short orchid-focused quiz.
        </p>
      </header>

      <div className="mb-4 flex items-center justify-between text-sm text-gray-500">
        <span>
          Question {currentIndex + 1} of {questions.length}
        </span>
        <span>Score: {score}</span>
      </div>

      <div className="flex-1 rounded-2xl bg-gray-50 p-4 border border-gray-100">
        <p className="font-medium text-gray-800">{currentQuestion.question}</p>
        <div className="mt-4 space-y-2">
          {currentQuestion.options.map((option, index) => (
            <label
              key={`${currentQuestion.id || currentIndex}-${index}`}
              className={`flex items-center gap-3 rounded-xl border px-3 py-3 cursor-pointer transition ${
                selectedOption === index
                  ? "border-green-600 bg-green-50"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name={`quiz-${currentIndex}`}
                value={index}
                checked={selectedOption === index}
                onChange={() => setSelectedOption(index)}
                className="h-4 w-4"
              />
              <span className="text-sm text-gray-700">{option}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-4">
        <button
          onClick={handleAnswer}
          disabled={selectedOption === null}
          className="w-full bg-green-600 text-white py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50"
        >
          {currentIndex + 1 === questions.length ? "Finish Quiz" : "Next Question"}
        </button>
      </div>
    </section>
  );
}
