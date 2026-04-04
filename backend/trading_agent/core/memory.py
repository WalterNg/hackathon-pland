from dataclasses import dataclass, field
from typing import List


@dataclass
class MemoryEntry:
    situation: str
    recommendation: str


@dataclass
class ConversationMemory:
    name: str
    entries: List[MemoryEntry] = field(default_factory=list)

    def add(self, situation: str, recommendation: str) -> None:
        self.entries.append(MemoryEntry(situation=situation, recommendation=recommendation))

    def recall(self, situation: str, limit: int = 2) -> list[str]:
        if not self.entries:
            return []
        query_terms = {term for term in situation.lower().split() if len(term) > 3}
        scored = []
        for entry in self.entries:
            overlap = len(query_terms.intersection({term for term in entry.situation.lower().split() if len(term) > 3}))
            scored.append((overlap, entry.recommendation))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [recommendation for score, recommendation in scored[:limit] if score > 0]

