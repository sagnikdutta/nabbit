
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
