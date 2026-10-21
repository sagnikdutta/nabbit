import { Challenge, Video } from './types';

export interface YouTubeParsed {
  videoId: string;
  timestamp?: number;
}

export function extractYouTubeVideoId(url: string): YouTubeParsed | null {
  if (!url) return null;
  const trimmed = url.trim();

  // If already an 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return { videoId: trimmed };
  }

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    let videoId = '';
    let timestamp: number | undefined;

    if (parsed.hostname.includes('youtu.be')) {
      videoId = parsed.pathname.replace(/^\//, '').split(/[?#]/)[0];
    } else if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname.startsWith('/embed/')) {
        videoId = parsed.pathname.split('/')[2];
      } else if (parsed.pathname.startsWith('/shorts/')) {
        videoId = parsed.pathname.split('/')[2];
      } else {
        videoId = parsed.searchParams.get('v') || '';
      }
    }

    // Extract timestamp if present (e.g. t=120 or t=2m15s)
    const t = parsed.searchParams.get('t');
    if (t) {
      if (/^\d+$/.test(t)) {
        timestamp = parseInt(t, 10);
      } else {
        const minutesMatch = t.match(/(\d+)m/);
        const secondsMatch = t.match(/(\d+)s/);
        const mins = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
        const secs = secondsMatch ? parseInt(secondsMatch[1], 10) : 0;
        timestamp = mins * 60 + secs;
      }
    }

    if (videoId && videoId.length === 11) {
      return { videoId, timestamp };
    }
  } catch {
    // regex fallback
    const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (match && match[1]) {
      return { videoId: match[1] };
    }
  }

  return null;
}

export const SAMPLE_YOUTUBE_PRESETS = [
  {
    label: 'AWS IAM & S3 Security',
    url: 'https://www.youtube.com/watch?v=k1RI5locZE4',
    topic: 'AWS IAM Security Policies & S3 Bucket Permissions',
    stack: 'aws',
  },
  {
    label: 'Terraform AWS Infrastructure',
    url: 'https://www.youtube.com/watch?v=SLB_c_ayRMo',
    topic: 'Terraform Security Group & Cloud VPC Declarations',
    stack: 'devops',
  },
  {
    label: 'Next.js 15 Server Actions',
    url: 'https://www.youtube.com/watch?v=RBM03RihZVs',
    topic: 'Next.js Server Actions & Form Mutations',
    stack: 'react',
  },
  {
    label: 'TypeScript 5 Generics',
    url: 'https://www.youtube.com/watch?v=d56mG7DezGs',
    topic: 'TypeScript Advanced Generics & Narrowing',
    stack: 'typescript',
  },
];

export function detectDomain(topicHint?: string, url?: string): 'aws' | 'devops' | 'python' | 'react' | 'javascript' {
  const text = `${topicHint || ''} ${url || ''}`.toLowerCase();
  if (text.includes('aws') || text.includes('iam') || text.includes('s3') || text.includes('cloud') || text.includes('ec2') || text.includes('lambda')) {
    return 'aws';
  }
  if (text.includes('terraform') || text.includes('docker') || text.includes('kubernetes') || text.includes('devops') || text.includes('k8s') || text.includes('ansible')) {
    return 'devops';
  }
  if (text.includes('python') || text.includes('fastapi') || text.includes('django') || text.includes('flask')) {
    return 'python';
  }
  if (text.includes('react') || text.includes('next') || text.includes('vue') || text.includes('svelte') || text.includes('hook') || text.includes('zustand')) {
    return 'react';
  }
  return 'javascript';
}

// Fallback smart templates when Gemini API key is unavailable or offline
export function generateFallbackPastedPack(
  youtubeId: string,
  topicHint?: string
): { video: Video; challenges: Challenge[] } {
  const domain = detectDomain(topicHint);
  const topic = topicHint?.trim() || (domain === 'aws' ? 'AWS IAM & Cloud Infrastructure Security' : 'Modern Web Development Architecture');
  const customId = `custom-${youtubeId}-${Date.now().toString(36)}`;

  // --- AWS / Cloud Domain Generator ---
  if (domain === 'aws') {
    const video: Video = {
      id: customId,
      title: topic.length > 55 ? topic.slice(0, 55) + '...' : topic,
      channel: 'AWS Certified Cloud Practitioner & Arch',
      stack: 'AWS / Cloud Architecture',
      youtubeId,
      duration: '38m',
      conceptCount: 2,
      description: `Security & IAM policy review drills based on "${topic}". Focuses on catching excessive privileges, wildcard exposures, and encryption oversights in code review.`,
      thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
      isUserCustom: true,
    };

    const challenges: Challenge[] = [
      {
        id: `${customId}-c1`,
        videoId: customId,
        concept: 'AWS IAM: Wildcard Action Privilege Escalation',
        chapter: 'Least Privilege & Resource-Based Policies',
        timestampSeconds: 240,
        timestampFormatted: '04:00',
        difficulty: 'Intermediate',
        filename: 'iam-policy.json',
        fileType: 'json',
        buggyLines: [7],
        buggyCode: `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowAppBucketReadWrite",
      "Effect": "Allow",
      "Action": ["s3:*"],
      "Resource": [
        "arn:aws:s3:::prod-customer-uploads",
        "arn:aws:s3:::prod-customer-uploads/*"
      ]
    }
  ]
}`,
        fixOptions: [
          'Replace "s3:*" with specific least-privilege actions: ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]',
          'Add a "Deny" statement for all other services at the top of the policy',
          'Change "Effect": "Allow" to "Effect": "Enable"',
          'Add a wildcard to the Resource ARN: "arn:aws:s3:::*" to grant cluster access',
        ],
        correctOption: 0,
        explanation: 'Granting "Action": ["s3:*"] violates the principle of least privilege. It grants the application identity permission to delete buckets (s3:DeleteBucket), wipe bucket policies (s3:DeleteBucketPolicy), and modify encryption or public access blocks. Code reviews for IAM policies must mandate specific granular permissions (e.g. s3:GetObject, s3:PutObject).',
        correctCode: `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowAppBucketReadWrite",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::prod-customer-uploads",
        "arn:aws:s3:::prod-customer-uploads/*"
      ]
    }
  ]
}`,
        takeaway: 'Never approve IAM policies with "s3:*" or service-wide wildcards for application roles; always enumerate the explicit required actions.',
        hints: {
          conceptNudge: 'Think about AWS least privilege guidelines and what administrative capabilities an asterisk wildcard (*) in Action grants to an S3 bucket.',
          videoTimestampSeconds: 240,
          inspectionClue: 'Look closely at line 7 ("Action": ["s3:*"]). It allows destructive admin actions like s3:DeleteBucket and s3:PutBucketPolicy.',
        },
      },
      {
        id: `${customId}-c2`,
        videoId: customId,
        concept: 'AWS VPC: Public Internet Ingress on Administrative Port',
        chapter: 'Security Groups & VPC Network Ingress',
        timestampSeconds: 580,
        timestampFormatted: '09:40',
        difficulty: 'Advanced',
        filename: 'main.tf',
        fileType: 'terraform',
        buggyLines: [9],
        buggyCode: `resource "aws_security_group" "bastion_ssh" {
  name        = "bastion-security-group"
  description = "Controls administrative SSH access to private cluster"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "SSH administrative entry"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}`,
        fixOptions: [
          'Restrict ingress CIDR to corporate VPN/bastion range: cidr_blocks = ["10.0.0.0/16"] or explicit office IPs',
          'Change protocol to "udp" to bypass public internet scanning',
          'Add a secondary ingress rule for port 80 to redirect SSH traffic',
          'Set to_port to 65535 to balance port exposure across the range',
        ],
        correctOption: 0,
        explanation: 'Setting cidr_blocks = ["0.0.0.0/0"] on port 22 exposes the SSH daemon to the entire public internet, allowing automated botnets to perform brute-force attacks and zero-day exploits. Security groups for administrative access must be strictly confined to internal VPN CIDRs, bastion IPs, or AWS Systems Manager Session Manager.',
        correctCode: `resource "aws_security_group" "bastion_ssh" {
  name        = "bastion-security-group"
  description = "Controls administrative SSH access to private cluster"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "SSH restricted to corporate VPN"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}`,
        takeaway: 'Never expose management ports (22 SSH, 3389 RDP) to 0.0.0.0/0 in cloud security groups. Restrict to VPN or private VPC CIDRs.',
        hints: {
          conceptNudge: 'Review cloud network perimeter principles and why 0.0.0.0/0 on port 22 triggers immediate security audit alerts.',
          videoTimestampSeconds: 580,
          inspectionClue: 'Check line 9 in the ingress block: cidr_blocks = ["0.0.0.0/0"] opens SSH port 22 to all 4.3 billion public internet IPs.',
        },
      },
    ];

    return { video, challenges };
  }

  // --- DevOps & Container Domain ---
  if (domain === 'devops') {
    const video: Video = {
      id: customId,
      title: topic.length > 55 ? topic.slice(0, 55) + '...' : topic,
      channel: 'DevOps & Cloud Engineering',
      stack: 'DevOps / Docker / Terraform',
      youtubeId,
      duration: '30m',
      conceptCount: 2,
      description: `Container security and layer caching drills from "${topic}". Trains you to catch root container execution and invalid cache ordering in code review.`,
      thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
      isUserCustom: true,
    };

    const challenges: Challenge[] = [
      {
        id: `${customId}-c1`,
        videoId: customId,
        concept: 'Docker: Container Running as Root User',
        chapter: 'Container Security & Non-Root Execution',
        timestampSeconds: 310,
        timestampFormatted: '05:10',
        difficulty: 'Intermediate',
        filename: 'Dockerfile',
        fileType: 'dockerfile',
        buggyLines: [7],
        buggyCode: `FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
# Bug: No non-root USER instruction specified before CMD
EXPOSE 3000
CMD ["node", "server.js"]`,
        fixOptions: [
          'Add a dedicated non-root user: USER node (or create a custom non-root system user) before CMD',
          'Add --privileged flag in the Dockerfile header',
          'Mount /etc/passwd as read-only volume in the container',
          'Prepend sudo before the CMD node server.js command',
        ],
        correctOption: 0,
        explanation: 'By default, Docker containers run all processes as the root user (UID 0). If an attacker exploits a remote code execution vulnerability in the application, they inherit root privileges inside the container, increasing the risk of container breakouts. Adding USER node instructs the container runtime to drop root privileges.',
        correctCode: `FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Fix: Drop root privileges before running application
USER node

EXPOSE 3000
CMD ["node", "server.js"]`,
        takeaway: 'Always specify a non-root USER in production Dockerfiles to enforce defense-in-depth against container breakout vulnerabilities.',
        hints: {
          conceptNudge: 'Consider Linux UID permissions inside a container and what user ID executes CMD if no user directive is declared.',
          videoTimestampSeconds: 310,
          inspectionClue: 'Look at line 7 and the CMD directive. The container never drops privileges from UID 0 (root).',
        },
      },
    ];

    return { video, challenges };
  }

  // --- Default Web & JavaScript Domain ---
  const video: Video = {
    id: customId,
    title: topic.length > 50 ? topic.slice(0, 50) + '...' : topic,
    channel: 'Community Dev Tutorial',
    stack: topic.toLowerCase().includes('typescript')
      ? 'typescript'
      : topic.toLowerCase().includes('react')
      ? 'react'
      : 'javascript',
    youtubeId,
    duration: '24m',
    conceptCount: 2,
    description: `Auto-generated bug hunt drills based on the tutorial "${topic}". Trains your ability to spot subtle logic edge-cases in code review.`,
    thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
    isUserCustom: true,
  };

  const challenges: Challenge[] = [
    {
      id: `${customId}-c1`,
      videoId: customId,
      concept: `${topic}: Direct State Mutation in Callback`,
      chapter: 'Core Implementation & State Architecture',
      timestampSeconds: 180,
      timestampFormatted: '03:00',
      difficulty: 'Intermediate',
      filename: 'state-store.ts',
      fileType: 'typescript',
      buggyLines: [7],
      buggyCode: `interface StoreState {
  items: string[];
  lastUpdated: number;
}

function updateCollection(state: StoreState, newItem: string): StoreState {
  // Intent: return updated store state
  state.items.push(newItem);
  state.lastUpdated = Date.now();
  return state;
}`,
      fixOptions: [
        'Return a shallow copy: return { ...state, items: [...state.items, newItem], lastUpdated: Date.now() }',
        'Call Object.freeze(state) before pushing to prevent unintended mutations',
        'Replace Array.push with state.items.unshift(newItem)',
        'Wrap the return statement in structuredClone(state) after mutating',
      ],
      correctOption: 0,
      explanation: 'Mutating state.items.push() directly alters the existing state object in place. Frameworks like React and Zustand rely on shallow reference equality (prev !== next) to detect state changes. Mutating in-place causes consumers to miss the update and fail to re-render. Always return a newly created object with cloned arrays.',
      correctCode: `interface StoreState {
  items: string[];
  lastUpdated: number;
}

function updateCollection(state: StoreState, newItem: string): StoreState {
  // Fix: Immutable return ensures reference change is detected
  return {
    ...state,
    items: [...state.items, newItem],
    lastUpdated: Date.now(),
  };
}`,
      takeaway: 'Never mutate state objects or arrays in-place in UI architectures. Always return new immutable copies so shallow reference checks detect updates.',
      hints: {
        conceptNudge: 'Think about how reactive state containers detect changes (reference identity vs deep comparison).',
        videoTimestampSeconds: 180,
        inspectionClue: 'Look at line 7: state.items.push(newItem) mutates the array in-place, keeping the exact same memory pointer.',
      },
    },
    {
      id: `${customId}-c2`,
      videoId: customId,
      concept: `${topic}: Unhandled Async Cancellation / Race Condition`,
      chapter: 'Data Fetching & Cleanup Handlers',
      timestampSeconds: 520,
      timestampFormatted: '08:40',
      difficulty: 'Advanced',
      filename: 'SearchBar.tsx',
      fileType: 'typescript',
      buggyLines: [7],
      buggyCode: `function SearchBar({ query, onResults }: { query: string; onResults: (res: any) => void }) {
  useEffect(() => {
    // Intent: fetch live suggestions as user types
    fetch(\`/api/search?q=\${encodeURIComponent(query)}\`)
      .then(res => res.json())
      .then(data => onResults(data));
  }, [query]);

  return <input placeholder="Search..." />;
}`,
      fixOptions: [
        'Use an AbortController in the effect cleanup to cancel in-flight requests or ignore stale responses',
        'Debounce the fetch with a setTimeout of 0 milliseconds',
        'Add onResults to the useEffect dependency array',
        'Convert fetch to synchronous XMLHttpRequest to ensure strict ordering',
      ],
      correctOption: 0,
      explanation: 'If a user types quickly, earlier requests might resolve AFTER later requests due to variable network latency. This is a classic asynchronous race condition where stale search results overwrite newer results. Using AbortController with controller.abort() in the useEffect cleanup cancels orphaned network requests on unmount or before the next query fires.',
      correctCode: `function SearchBar({ query, onResults }: { query: string; onResults: (res: any) => void }) {
  useEffect(() => {
    const controller = new AbortController();

    fetch(\`/api/search?q=\${encodeURIComponent(query)}\`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => onResults(data))
      .catch(err => {
        if (err.name !== 'AbortError') console.error(err);
      });

    // Fix: Cancel active request if query changes
    return () => controller.abort();
  }, [query]);

  return <input placeholder="Search..." />;
}`,
      takeaway: 'Always clean up or abort asynchronous effects that depend on dynamic inputs (like search queries) to prevent race conditions where stale data overwrites fresh state.',
      hints: {
        conceptNudge: 'Consider what happens when multiple network requests with varying response times are triggered in rapid succession.',
        videoTimestampSeconds: 520,
        inspectionClue: 'Notice that useEffect initiates a fetch call on every query change without returning a cleanup function to abort the prior request.',
      },
    },
  ];

  return { video, challenges };
}
