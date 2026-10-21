import { Video, Challenge } from '../lib/types';

export const CURATED_VIDEOS: Video[] = [
  {
    id: 'react-mosh',
    title: 'React Tutorial for Beginners',
    channel: 'Programming with Mosh',
    stack: 'react',
    youtubeId: 'SqcY0GlETPk',
    duration: '1h 20m',
    conceptCount: 4,
    description: 'Master core React fundamentals: state mutation rules, reconciliation keys, conditional rendering caveats, and event handler signatures.',
    thumbnailUrl: 'https://img.youtube.com/vi/SqcY0GlETPk/hqdefault.jpg',
  },
  {
    id: 'js-async-promises',
    title: 'JavaScript Async / Await & Promises Explained',
    channel: 'Fireship',
    stack: 'javascript',
    youtubeId: 'vn3tm0quoqE',
    duration: '12m',
    conceptCount: 3,
    description: 'Catch asynchronous traps before production: Array.prototype.forEach pitfalls, silent fetch HTTP rejections, and Promise.all vs allSettled.',
    thumbnailUrl: 'https://img.youtube.com/vi/vn3tm0quoqE/hqdefault.jpg',
  },
  {
    id: 'react-useeffect-deepdive',
    title: 'Learn useEffect & Lifecycle Cleanup',
    channel: 'Web Dev Simplified',
    stack: 'react',
    youtubeId: '0ZJgIjIuY7U',
    duration: '13m',
    conceptCount: 3,
    description: 'Deep dive into React effect synchronization: solving stale closures in timers, memory leak cleanup on unmount, and infinite dependency cascades.',
    thumbnailUrl: 'https://img.youtube.com/vi/0ZJgIjIuY7U/hqdefault.jpg',
  },
];

export const CURATED_CHALLENGES: Challenge[] = [
  // --- React with Mosh ---
  {
    id: 'react-state-batching',
    videoId: 'react-mosh',
    concept: 'State Batching & Stale Snapshot',
    chapter: 'Updating State & Render Queues',
    timestampSeconds: 1420,
    timestampFormatted: '23:40',
    difficulty: 'Beginner',
    buggyLines: [7],
    buggyCode: `function Counter() {
  const [count, setCount] = useState(0);

  const handleIncrementTwice = () => {
    // Intent: increment count twice in a single click handler
    setCount(count + 1);
    setCount(count + 1);
  };

  return (
    <button onClick={handleIncrementTwice}>
      Count: {count}
    </button>
  );
}`,
    fixOptions: [
      'Pass functional updaters: setCount(prev => prev + 1) for queued updates',
      'Wrap the second call in setTimeout(() => setCount(count + 1), 0)',
      'Convert useState to useRef to bypass asynchronous reconciliation',
      'Call setCount(count + 2) only after checking document.hasFocus()',
    ],
    correctOption: 0,
    explanation: 'React batches state updates inside event handlers and evaluates them against the current render snapshot. In both setCount(count + 1) calls, count equals 0, so both compute 0 + 1 = 1. Using a functional updater setCount(prev => prev + 1) instructs React to pass the latest pending state to the next update, correctly producing 2.',
    correctCode: `function Counter() {
  const [count, setCount] = useState(0);

  const handleIncrementTwice = () => {
    // Fix: Functional updater references latest queued value
    setCount(prev => prev + 1);
    setCount(prev => prev + 1);
  };

  return (
    <button onClick={handleIncrementTwice}>
      Count: {count}
    </button>
  );
}`,
    takeaway: 'Never reference the current state variable multiple times in the same handler when you need sequential updates; always pass an updater callback (prev => ...).',
  },
  {
    id: 'react-missing-list-key',
    videoId: 'react-mosh',
    concept: 'Reconciliation & Stable List Keys',
    chapter: 'Rendering Lists & Virtual DOM',
    timestampSeconds: 1980,
    timestampFormatted: '33:00',
    difficulty: 'Beginner',
    buggyLines: [11],
    buggyCode: `interface TodoItem {
  id: string;
  title: string;
}

function TodoList({ items }: { items: TodoItem[] }) {
  return (
    <ul className="todo-list">
      {items.map((item) => (
        <li>
          <input type="checkbox" />
          <span>{item.title}</span>
        </li>
      ))}
    </ul>
  );
}`,
    fixOptions: [
      'Add a stable identifier key from data: <li key={item.id}>',
      'Use the array index as key: items.map((item, index) => <li key={index}>)',
      'Generate a random key: <li key={Math.random()}> to force fresh mounts',
      'Use the item title as key: <li key={item.title}> to reflect content',
    ],
    correctOption: 0,
    explanation: 'Without a stable key prop, React falls back to item position during reconciliation. When items are inserted, deleted, or reordered, uncontrolled DOM nodes (like checkboxes, text inputs, or focus states) remain bound to their original index, causing data corruption. Using the database/item ID ensures React pairs DOM elements to actual data identity.',
    correctCode: `interface TodoItem {
  id: string;
  title: string;
}

function TodoList({ items }: { items: TodoItem[] }) {
  return (
    <ul className="todo-list">
      {items.map((item) => (
        <li key={item.id}>
          <input type="checkbox" />
          <span>{item.title}</span>
        </li>
      ))}
    </ul>
  );
}`,
    takeaway: 'Never use array indices as keys when the list can change order, filter, or delete items. Always provide unique, stable identifiers from data.',
  },
  {
    id: 'react-ampersand-zero',
    videoId: 'react-mosh',
    concept: 'The && Falsy Zero Leak',
    chapter: 'Conditional Rendering Caveats',
    timestampSeconds: 2540,
    timestampFormatted: '42:20',
    difficulty: 'Intermediate',
    buggyLines: [8],
    buggyCode: `interface InboxProps {
  unreadMessages: string[];
}

function MessageInbox({ unreadMessages }: InboxProps) {
  return (
    <div className="inbox-banner">
      {unreadMessages.length && (
        <p>You have {unreadMessages.length} unread notifications</p>
      )}
    </div>
  );
}`,
    fixOptions: [
      'Compare explicitly: {unreadMessages.length > 0 && (<p>...</p>)}',
      'Cast the array to string: {String(unreadMessages) && (<p>...</p>)}',
      'Use logical OR: {unreadMessages.length || (<p>...</p>)}',
      'Wrap in ternary returning null only when empty: {unreadMessages ? ... : null}',
    ],
    correctOption: 0,
    explanation: 'In JavaScript, the logical expression 0 && <Component /> evaluates directly to the left operand (0), NOT false. When React receives the number 0 inside JSX children, it renders a literal "0" text node into the DOM rather than empty space! Converting the predicate to a true boolean with length > 0 or Boolean(length) fixes this bug cleanly.',
    correctCode: `interface InboxProps {
  unreadMessages: string[];
}

function MessageInbox({ unreadMessages }: InboxProps) {
  return (
    <div className="inbox-banner">
      {unreadMessages.length > 0 && (
        <p>You have {unreadMessages.length} unread notifications</p>
      )}
    </div>
  );
}`,
    takeaway: 'Never use raw numeric counts with the && operator in JSX. Always write count > 0 && ... to prevent unwanted "0" numbers leaking onto your UI.',
  },
  {
    id: 'react-handler-invocation',
    videoId: 'react-mosh',
    concept: 'Immediate Function Invocation in Handlers',
    chapter: 'Handling Events & Passing Arguments',
    timestampSeconds: 3120,
    timestampFormatted: '52:00',
    difficulty: 'Beginner',
    buggyLines: [6],
    buggyCode: `interface UserCardProps {
  userId: string;
  onDelete: (id: string) => void;
}

function UserCard({ userId, onDelete }: UserCardProps) {
  return (
    <div className="user-card">
      <h4>User ID: {userId}</h4>
      <button onClick={onDelete(userId)}>
        Delete Account
      </button>
    </div>
  );
}`,
    fixOptions: [
      'Pass an arrow callback: onClick={() => onDelete(userId)}',
      'Attach arguments as HTML attributes: <button onClick={onDelete} data-id={userId}>',
      'Wrap button in a form: <form onSubmit={onDelete(userId)}>',
      'Assign window handler: onClick={window.handleDelete = () => onDelete(userId)}',
    ],
    correctOption: 0,
    explanation: 'Writing onClick={onDelete(userId)} invokes onDelete immediately during the component render cycle, passing its return value (typically undefined) to the event handler. If onDelete updates state, this immediately triggers a re-render, creating an infinite render loop and deleting the user upon mounting! An arrow function delays execution until user click.',
    correctCode: `interface UserCardProps {
  userId: string;
  onDelete: (id: string) => void;
}

function UserCard({ userId, onDelete }: UserCardProps) {
  return (
    <div className="user-card">
      <h4>User ID: {userId}</h4>
      <button onClick={() => onDelete(userId)}>
        Delete Account
      </button>
    </div>
  );
}`,
    takeaway: 'JSX event attributes expect a function reference. If you need to pass arguments, wrap the call in an arrow function () => fn(arg) or use bind.',
  },

  // --- JavaScript Async & Promises ---
  {
    id: 'js-async-foreach',
    videoId: 'js-async-promises',
    concept: 'Array forEach with Async Callbacks',
    chapter: 'Asynchronous Iteration & Concurrency',
    timestampSeconds: 340,
    timestampFormatted: '05:40',
    difficulty: 'Intermediate',
    buggyLines: [5],
    buggyCode: `async function syncDatabaseUsers(userIds: string[]) {
  console.log("Starting batch sync...");

  // Bug: forEach ignores returned promises
  userIds.forEach(async (id) => {
    const user = await fetchRemoteUser(id);
    await saveToLocalDb(user);
  });

  console.log("All users successfully synced!");
}`,
    fixOptions: [
      'Use a for...of loop, or await Promise.all(userIds.map(async id => ...))',
      'Prefix the forEach call with await: await userIds.forEach(...)',
      'Return a boolean from the callback: return await saveToLocalDb(user)',
      'Convert the callback into a synchronous generator function',
    ],
    correctOption: 0,
    explanation: 'Array.prototype.forEach is completely synchronous. It invokes the callback for each item and discards whatever the callback returns (including Promises). As a result, syncDatabaseUsers logs "All users successfully synced!" immediately, long before any remote fetch completes. To run sequentially use for (const id of userIds) { await ... }; to run concurrently use await Promise.all(userIds.map(...)).',
    correctCode: `async function syncDatabaseUsers(userIds: string[]) {
  console.log("Starting batch sync...");

  // Fix: Promise.all concurrently waits for all iterations
  await Promise.all(
    userIds.map(async (id) => {
      const user = await fetchRemoteUser(id);
      await saveToLocalDb(user);
    })
  );

  console.log("All users successfully synced!");
}`,
    takeaway: 'Never use async functions inside Array.prototype.forEach. Always use for...of for sequential async iteration or Promise.all() for concurrent operations.',
  },
  {
    id: 'js-unhandled-rejection',
    videoId: 'js-async-promises',
    concept: 'Silent Unhandled Fetch Error',
    chapter: 'Error Handling & HTTP Response Statuses',
    timestampSeconds: 540,
    timestampFormatted: '09:00',
    difficulty: 'Beginner',
    buggyLines: [4],
    buggyCode: `async function loadDashboardMetrics() {
  try {
    const response = await fetch("/api/v1/metrics");
    // Bug: 404/500 does NOT reject fetch promise!
    const data = await response.json();
    return data;
  } catch (err) {
    console.error("Network request failed", err);
    throw err;
  }
}`,
    fixOptions: [
      'Check response.ok: if (!response.ok) throw new Error(`HTTP ${response.status}`)',
      'Wrap the endpoint path in new URL("/api/v1/metrics")',
      'Pass { rejectOnHttpError: true } in the fetch options object',
      'Chain .catch(() => null) directly on response.json()',
    ],
    correctOption: 0,
    explanation: 'The Fetch API only rejects a promise when a network failure occurs (e.g., DNS error, offline, CORS failure). HTTP error responses such as 404 Not Found or 500 Internal Server Error resolve successfully! Without inspecting response.ok, response.json() attempts to parse error responses (often HTML), causing misleading JSON parse errors.',
    correctCode: `async function loadDashboardMetrics() {
  try {
    const response = await fetch("/api/v1/metrics");
    if (!response.ok) {
      throw new Error(\`Request failed with status: \${response.status}\`);
    }
    const data = await response.json();
    return data;
  } catch (err) {
    console.error("Network request failed", err);
    throw err;
  }
}`,
    takeaway: 'Always inspect response.ok or response.status before parsing fetch responses. HTTP 4xx and 5xx do not trigger catch blocks on their own.',
  },
  {
    id: 'js-promise-all-failfast',
    videoId: 'js-async-promises',
    concept: 'Promise.all Fast-Fail vs allSettled',
    chapter: 'Concurrent Promise Combinators',
    timestampSeconds: 680,
    timestampFormatted: '11:20',
    difficulty: 'Advanced',
    buggyLines: [5],
    buggyCode: `async function loadBatchReports(reportIds: string[]) {
  // If one optional report has expired, we still need all other reports
  const reportPromises = reportIds.map(id => fetchReport(id));

  // Bug: One single rejection drops all other successful reports
  const reports = await Promise.all(reportPromises);
  return reports;
}`,
    fixOptions: [
      'Use Promise.allSettled(reportPromises) and filter for fulfilled items',
      'Append .then(() => true) to suppress rejection errors',
      'Add mode: "no-cors" to the fetch requests',
      'Use Promise.race with an empty fallback array',
    ],
    correctOption: 0,
    explanation: 'Promise.all has "fast-fail" semantics: if any single promise in the iterable rejects, the whole Promise.all immediately rejects, discarding all other settled values. When loading batch data where partial success is acceptable, Promise.allSettled guarantees all promises settle and returns their outcome records.',
    correctCode: `async function loadBatchReports(reportIds: string[]) {
  const reportPromises = reportIds.map(id => fetchReport(id));

  // Fix: allSettled tolerates partial failures
  const results = await Promise.allSettled(reportPromises);
  return results
    .filter((res): res is PromiseFulfilledResult<any> => res.status === 'fulfilled')
    .map(res => res.value);
}`,
    takeaway: 'Use Promise.all when operations are atomic and all must succeed; use Promise.allSettled when items are independent and partial success is desirable.',
  },

  // --- React useEffect & Lifecycle ---
  {
    id: 'effect-stale-closure',
    videoId: 'react-useeffect-deepdive',
    concept: 'Stale Closure in Interval Effect',
    chapter: 'Synchronization & Closure Scopes',
    timestampSeconds: 240,
    timestampFormatted: '04:00',
    difficulty: 'Intermediate',
    buggyLines: [7],
    buggyCode: `function AutoSavingTimer() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      // Bug: Captured initial seconds (0) in closure
      setSeconds(seconds + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []); // Empty dependency array

  return <div>Active for: {seconds}s</div>;
}`,
    fixOptions: [
      'Use functional updater: setSeconds(prev => prev + 1)',
      'Replace setInterval with a synchronous while(true) loop',
      'Store seconds in sessionStorage and read it inside setInterval',
      'Pass [setInterval] in the dependency array',
    ],
    correctOption: 0,
    explanation: 'Because the effect has an empty dependency array [], it runs once on mount. The setInterval callback closes over the initial render scope where seconds is 0. Every tick, it calculates 0 + 1 = 1, freezing the timer at 1. Passing the updater callback setSeconds(prev => prev + 1) gives access to the latest state without re-creating the interval.',
    correctCode: `function AutoSavingTimer() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      // Fix: Updater callback always receives latest state
      setSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return <div>Active for: {seconds}s</div>;
}`,
    takeaway: 'Whenever setting state inside a timer or event listener that does not re-subscribe on every change, always use functional state updaters to prevent stale closures.',
  },
  {
    id: 'effect-missing-cleanup',
    videoId: 'react-useeffect-deepdive',
    concept: 'Missing Event Listener Cleanup',
    chapter: 'Event Subscriptions & Memory Leaks',
    timestampSeconds: 430,
    timestampFormatted: '07:10',
    difficulty: 'Beginner',
    buggyLines: [7],
    buggyCode: `function WindowWidthTracker() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    // Bug: No cleanup function returned on unmount!
    window.addEventListener('resize', handleResize);
  }, []);

  return <span>Viewport width: {width}px</span>;
}`,
    fixOptions: [
      'Return a cleanup function: return () => window.removeEventListener("resize", handleResize);',
      'Assign window.onresize = handleResize directly to override listeners',
      'Pass { once: true } in the event listener options',
      'Move addEventListener into the render function body',
    ],
    correctOption: 0,
    explanation: 'Effects that subscribe to global events or external sources must clean up after themselves. Without returning a cleanup function that calls removeEventListener, every mount/unmount cycle leaves an active listener in browser memory, resulting in memory leaks and attempts to set state on unmounted components.',
    correctCode: `function WindowWidthTracker() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);

    // Fix: Remove listener when component unmounts
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <span>Viewport width: {width}px</span>;
}`,
    takeaway: 'Every useEffect that registers a listener, subscription, or timer must return a corresponding cleanup function.',
  },
  {
    id: 'effect-infinite-loop',
    videoId: 'react-useeffect-deepdive',
    concept: 'Infinite Re-render Loop via State Mutation',
    chapter: 'Dependencies & Derived State Anti-Patterns',
    timestampSeconds: 660,
    timestampFormatted: '11:00',
    difficulty: 'Advanced',
    buggyLines: [6],
    buggyCode: `interface ProfileProps {
  user: { name: string; visits: number };
}

function ProfileSummary({ user }: ProfileProps) {
  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    // Bug: Updating state that is also in dependency array
    setHistory([...history, user.visits]);
  }, [history, user.visits]);

  return <div>Logged visits: {history.length}</div>;
}`,
    fixOptions: [
      'Remove history from dependencies and calculate derived state or use functional updater with change guard',
      'Mutate history.push(user.visits) directly without triggering setHistory',
      'Wrap setHistory in queueMicrotask to bypass React loop detection',
      'Add [true] as the dependency array to force single execution',
    ],
    correctOption: 0,
    explanation: 'The effect runs, calls setHistory (which creates a new array reference), which changes history, which triggers the effect again immediately. This causes an infinite re-render loop that freezes the browser tab. In React, you should avoid using effects to synchronize state with other state; compute values during rendering, or guard updates.',
    correctCode: `interface ProfileProps {
  user: { name: string; visits: number };
}

function ProfileSummary({ user }: ProfileProps) {
  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    // Fix: Only update when visits genuinely changes, without depending on history
    setHistory(prev => {
      if (prev[prev.length - 1] === user.visits) return prev;
      return [...prev, user.visits];
    });
  }, [user.visits]);

  return <div>Logged visits: {history.length}</div>;
}`,
    takeaway: 'Never set state inside an effect that unconditionally depends on that same state. If state can be derived from props, compute it during rendering instead.',
  },
];
