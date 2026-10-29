import { useEffect, useState } from "react";
import { todayInManila } from "./finance-utils";

type Quote = { text: string; by?: string };

// One quote per calendar day (Manila time). The list cycles, so it never runs out.
const quotes: Quote[] = [
  { text: "Beware of little expenses; a small leak will sink a great ship.", by: "Benjamin Franklin" },
  { text: "Do not save what is left after spending; spend what is left after saving.", by: "Warren Buffett" },
  { text: "Little by little, a little becomes a lot.", by: "Tanzanian proverb" },
  { text: "Take care of the pennies and the pounds will take care of themselves.", by: "Proverb" },
  { text: "Wealth consists not in having great possessions, but in having few wants.", by: "Epictetus" },
  { text: "Never spend your money before you have it.", by: "Thomas Jefferson" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", by: "Robert Collier" },
  { text: "Small steps still move you forward." },
  { text: "Waste not, want not.", by: "Proverb" },
  { text: "The best time to start was yesterday. The next best time is today.", by: "Proverb" },
  { text: "Track it, plan it, own it." },
  { text: "It is not your salary that makes you rich; it is your spending habits.", by: "Charles A. Jaffe" },
  { text: "A budget tells your money where to go instead of wondering where it went." },
  { text: "Well begun is half done.", by: "Aristotle" },
  { text: "Rome wasn't built in a day.", by: "Proverb" },
  { text: "An investment in knowledge pays the best interest.", by: "Benjamin Franklin" },
  { text: "A penny saved is a penny earned.", by: "Proverb" },
  { text: "Spend on what matters. Skip what doesn't." },
  { text: "Today's choices are tomorrow's balance." },
  { text: "Know what you owe, know what you're owed." },
  { text: "Progress beats perfection, especially with money." },
  { text: "Pay yourself first, then plan the rest." },
  { text: "Every peso has a job. Give it one." },
  { text: "The habit matters more than the amount." },
  { text: "Share the bill, not the stress." },
  { text: "Patience is the quiet engine of savings." },
  { text: "Look at the week, not just the day." },
  { text: "Good records make easy decisions." },
  { text: "Save a little now so you can say yes later." },
  { text: "Calm money starts with clear numbers." },
  { text: "Make saving the easy default." },
];

export const quoteForDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return quotes[Math.floor(Date.UTC(y, m - 1, d) / 86400000) % quotes.length];
};

export function QuoteOfTheDay({ className = "" }: { className?: string }) {
  const [day, setDay] = useState(todayInManila);
  // Roll over to the next quote when the date changes while the app is open.
  useEffect(() => {
    const check = () => setDay(todayInManila());
    const timer = window.setInterval(check, 60000);
    document.addEventListener("visibilitychange", check);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, []);
  const quote = quoteForDay(day);
  return <figure className={`daily-quote ${className}`} aria-label="Quote of the day">
    <figcaption className="daily-quote-label">Quote of the day</figcaption>
    <blockquote>“{quote.text}”</blockquote>
    {quote.by && <p className="daily-quote-by">— {quote.by}</p>}
  </figure>;
}
