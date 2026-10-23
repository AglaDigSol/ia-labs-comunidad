// /flashcards/* routes. App.tsx lazy-loads this module so KaTeX-heavy card code stays out of the
// entry chunk.
import { Route, Routes } from "react-router";
import { DeckPage } from "./DeckPage.tsx";
import { DecksPage } from "./DecksPage.tsx";
import { ReviewPage } from "./ReviewPage.tsx";

export function CardsRoutes() {
  return (
    <Routes>
      <Route index element={<DecksPage />} />
      <Route path="repaso" element={<ReviewPage />} />
      <Route path=":mazo" element={<DeckPage />} />
    </Routes>
  );
}
