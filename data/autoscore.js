// Auto-scoring module for objective LLM evaluation questions
// Provides reference answers and scoring functions for: code_algo, reasoning, knowledge, instruction, long_context

// Normalize answer text for matching: remove markdown, LaTeX, extra spaces
function normAnswer(answer) {
  return (answer || '').replace(/\s+/g, '').replace(/[*$_{}\\]/g, '').replace(/`/g, '').toLowerCase();
}

const REF_ANSWERS = {
  // === Algorithm & Programming ===
  "两数之和": {
    key_concepts: ["hash map", "哈希", "dict", "O(n)", "enumerate"],
    reference: "使用哈希表，遍历数组，对每个元素检查target-nums[i]是否在哈希表中。时间O(n)，空间O(n)。",
    code_patterns: ["dict()", "enumerate", "return [", "hash"],
    max: 60,
    rubric: (answer) => {
      let score = 0;
      const a = answer.toLowerCase();
      const n = normAnswer(answer);
      if (a.includes('hash') || a.includes('dict') || a.includes('哈希')) score += 20;
      if (a.includes('o(n)') || a.includes('on)')) score += 15;
      if (answer.includes('return') && (answer.includes('[') || answer.includes('('))) score += 15;
      if (answer.length > 200) score += 10;
      return { score: Math.min(score, 60), breakdown: { algorithm: score >= 20, complexity: a.includes('o(n)'), implementation: answer.includes('def '), quality: answer.length > 200 }};
    }
  },
  "LRU缓存": {
    key_concepts: ["OrderedDict", "双向链表", "doubly linked list", "O(1)", "dict + list"],
    reference: "使用OrderedDict或dict+双向链表实现。get和put均为O(1)。",
    code_patterns: ["class LRUCache", "def get", "def put", "capacity"],
    max: 75,
    rubric: (answer) => {
      let score = 0;
      const a = answer.toLowerCase();
      const n = normAnswer(answer);
      if (a.includes('class') && (a.includes('lru') || a.includes('cache'))) score += 20;
      if (a.includes('ordereddict') || a.includes('linked') || a.includes('链表')) score += 20;
      if (answer.includes('def get') && answer.includes('def put')) score += 20;
      if (a.includes('o(1)')) score += 15;
      return { score: Math.min(score, 75), breakdown: { class_design: score >= 20, data_structure: a.includes('ordereddict') || a.includes('linked'), methods: answer.includes('def get'), complexity: a.includes('o(1)') }};
    }
  },
  "前K个高频元素": {
    key_concepts: ["Counter", "桶排序", "heap", "heapq", "top-k"],
    reference: "用Counter统计频率，然后用堆排序或桶排序取前k个。O(n)时间。",
    code_patterns: ["Counter", "heapq", "most_common", "bucket"],
    max: 90,
    rubric: (answer) => {
      let score = 0;
      const a = answer.toLowerCase();
      const n = normAnswer(answer);
      if (a.includes('counter') || a.includes('count') || a.includes('频率')) score += 25;
      if (a.includes('heap') || a.includes('桶') || a.includes('bucket') || a.includes('most_common')) score += 25;
      if (a.includes('o(n)') || a.includes('on)')) score += 20;
      if (answer.includes('def ') || answer.includes('return')) score += 20;
      return { score: Math.min(score, 90), breakdown: { counting: a.includes('counter') || a.includes('count'), selection: a.includes('heap') || a.includes('桶'), complexity: a.includes('o(n)'), implementation: answer.includes('def ') }};
    }
  },
  "接雨水": {
    key_concepts: ["双指针", "two pointer", "左右最大值", "单调栈", "O(n)", "O(1)"],
    reference: "双指针法：维护左右两侧最大高度，从较矮的一侧向中间移动。时间O(n)空间O(1)。",
    max: 100,
    rubric: (answer) => {
      let score = 0;
      const a = answer.toLowerCase();
      const n = normAnswer(answer);
      const len = answer.length;
      const hasTwoPointer = n.includes('双指针') || n.includes('twopointer') || (n.includes('left') && n.includes('right'));
      if (hasTwoPointer) score += 15;
      if (n.includes('o(n)')) score += 10;
      if (n.includes('o(1)') || n.includes('空间复杂度')) score += 10;
      if (n.includes('def') && n.includes('while')) score += 5;
      if (n.includes('木桶') || n.includes('短板') || n.includes('限制因素')) score += 8;
      if (n.includes('为什么') || n.includes('原理') || n.includes('核心思想')) score += 7;
      if (n.includes('单调栈') || n.includes('monotonic') || n.includes('动态规划') || n.includes('dp')) score += 8;
      if (n.includes('示例') || n.includes('测试') || n.includes('输出') || n.includes('print')) score += 7;
      const codeLines = answer.split('\n').filter(l => l.trim().length > 0);
      const commentLines = codeLines.filter(l => l.includes('#') || l.includes('"""') || l.includes("'''"));
      if (commentLines.length >= 3) score += 8; else if (commentLines.length >= 1) score += 4;
      if (answer.includes('List[') || answer.includes('-> ')) score += 5;
      if (len > 1500) score += 7; else if (len > 800) score += 4; else if (len > 400) score += 2;
      const hasSections = (answer.match(/#{1,3}\s/g) || []).length >= 2;
      if (hasSections) score += 5;
      return { score: Math.min(score, 100), breakdown: { basic: hasTwoPointer ? 40 : 15, depth: score > 40 ? 30 : 10, quality: score > 70 ? 30 : 10, explanation: `算法:${hasTwoPointer?'✓':'✗'} 解释:${len>800?'深':'浅'} 替代:${n.includes('单调栈')?'有':'无'}` }};
    }
  },

  // === Logical Reasoning ===
  "数字规律": {
    key_concepts: ["42", "n(n+1)", "差分数列", "二级等差"],
    reference: "规律：差分数列为4,6,8,10,12，即相邻差递增2。答案是42。通项公式a(n)=n(n+1)。",
    expected_answer: "42",
    max: 60,
    rubric: (answer) => {
      let score = 0;
      // Normalize: remove spaces, markdown, LaTeX for matching
      const norm = answer.replace(/\s+/g, '').replace(/[*$_{}]/g, '').toLowerCase();
      if (norm.includes('42')) score += 25;
      // Formula check: n(n+1), n²+n, n^2+n, n*n+n (all variants)
      if (norm.includes('n(n+1)') || norm.includes('n*(n+1)') || norm.includes('n²+n') || norm.includes('n^2+n') || norm.includes('n*n+n')) score += 15;
      // Reasoning: give credit for each keyword found
      if (norm.includes('差') || norm.includes('递增') || norm.includes('等差')) score += 10;
      if (norm.includes('验证') || norm.includes('验证') || norm.includes('代入')) score += 5;
      if (answer.length > 200) score += 5;
      return { score: Math.min(score, 60), breakdown: { correct_answer: norm.includes('42'), formula: norm.includes('n^2+n') || norm.includes('n(n+1)'), reasoning: norm.includes('差') || norm.includes('递增'), detail: answer.length > 200 }};
    }
  },
  "过桥问题": {
    key_concepts: ["17", "17分钟", "策略", "贪心"],
    reference: "答案17分钟。策略：1+2过(2分)，1回(1分)，5+10过(10分)，2回(2分)，1+2过(2分)。总计2+1+10+2+2=17。",
    expected_answer: "17",
    max: 75,
    rubric: (answer) => {
      let score = 0;
      const n = normAnswer(answer);
      if (n.includes('17')) score += 35;
      if (n.includes('1') && n.includes('2') && n.includes('5') && n.includes('10')) score += 15;
      if (answer.includes('回') || answer.includes('返回') || answer.includes('back')) score += 15;
      if (answer.length > 200) score += 10;
      return { score: Math.min(score, 75), breakdown: { correct_answer: answer.includes('17'), steps: answer.includes('回') || answer.includes('返回'), detail: answer.length > 200 }};
    }
  },
  "蒙提霍尔问题": {
    key_concepts: ["2/3", "条件概率", "贝叶斯", "换门", "信息不对称"],
    reference: "换门后中奖概率2/3。因为初始选对概率1/3，选错概率2/3。主持人打开一扇有山羊的门后，选错的2/3概率全部转移到另一扇门。",
    expected_answer: "2/3",
    max: 90,
    rubric: (answer) => {
      let score = 0;
      const n = normAnswer(answer);
      if (n.includes('2/3') || answer.includes('66') || answer.includes('三分之二')) score += 30;
      if (n.includes('1/3') || n.includes('33%') || n.includes('三分之一')) score += 15;
      if (n.includes('条件概率') || n.includes('贝叶斯') || n.includes('bayes')) score += 15;
      if (n.includes('主持人') || n.includes('monty') || n.includes('host')) score += 10;
      if (answer.length > 300) score += 20;
      return { score: Math.min(score, 90), breakdown: { correct_prob: answer.includes('2/3'), initial_prob: answer.includes('1/3'), method: answer.includes('条件概率') || answer.includes('贝叶斯'), explanation: answer.length > 300 }};
    }
  },
  "贝叶斯推理": {
    key_concepts: ["约1.96%", "约2%", "贝叶斯", "假阳性", "先验"],
    reference: "P(患病|阳性) = P(阳性|患病)×P(患病) / P(阳性) = 0.99×0.001 / (0.99×0.001 + 0.05×0.999) ≈ 0.0194 ≈ 1.94%。直觉高估是因为忽略了基础概率(发病率极低)和假阳性数量。",
    expected_answer: "约2%",
    max: 100,
    rubric: (answer) => {
      let score = 0;
      const a = answer;
      const n = normAnswer(answer);
      if (n.includes('1.9') || n.includes('2%') || n.includes('1.94') || n.includes('1.96')) score += 30;
      if (n.includes('贝叶斯') || n.includes('bayes') || n.includes('p(')) score += 20;
      if (n.includes('0.99') || n.includes('0.001') || n.includes('0.05')) score += 15;
      if (n.includes('假阳性') || n.includes('falsepositive')) score += 10;
      if (n.includes('基础概率') || n.includes('先验') || n.includes('prior') || n.includes('发病率')) score += 10;
      if (answer.length > 400) score += 15;
      return { score: Math.min(score, 100), breakdown: { correct_answer: a.includes('1.9') || a.includes('2%'), formula: a.includes('贝叶斯'), numbers: a.includes('0.99'), insight: a.includes('假阳性') || a.includes('基础概率') }};
    }
  },

  // === Knowledge ===
  "基础物理": {
    key_concepts: ["波粒二象性", "干涉", "衍射", "光电效应", "德布罗意", "互补原理"],
    required_terms: ["波", "粒子", "光"],
    max: 60,
    rubric: (answer) => {
      let score = 0;
      const terms = ["波", "粒子", "光", "干涉", "衍射", "光电效应", "量子", "德布罗意"];
      const found = terms.filter(t => answer.includes(t));
      score += Math.min(found.length * 8, 40);
      if (answer.length > 100) score += 10;
      if (answer.length > 200) score += 10;
      return { score: Math.min(score, 60), breakdown: { terms: found.length, depth: answer.length > 200 }};
    }
  },
  "量子计算": {
    key_concepts: ["叠加", "纠缠", "量子比特", "qubit", "并行", "Shor", "Grover"],
    max: 75,
    rubric: (answer) => {
      let score = 0;
      const terms = ["叠加", "纠缠", "量子比特", "qubit", "并行", "经典比特", "0和1", "概率"];
      const found = terms.filter(t => answer.toLowerCase().includes(t.toLowerCase()));
      score += Math.min(found.length * 8, 40);
      if (answer.includes('Shor') || answer.includes('Grover') || answer.includes('肖尔') || answer.includes('格罗弗')) score += 10;
      if (answer.length > 150) score += 10;
      if (answer.length > 300) score += 15;
      return { score: Math.min(score, 75), breakdown: { concepts: found.length, algorithms: answer.includes('Shor') || answer.includes('Grover'), depth: answer.length > 300 }};
    }
  },
  "CRISPR技术": {
    key_concepts: ["Cas9", "guide RNA", "gRNA", "PAM", "DNA", "切割", "编辑", "脱靶"],
    max: 90,
    rubric: (answer) => {
      let score = 0;
      const terms = ["Cas9", "guide RNA", "gRNA", "PAM", "DNA", "切割", "编辑", "脱靶", "靶向", "基因组"];
      const found = terms.filter(t => answer.includes(t));
      score += Math.min(found.length * 8, 50);
      if (answer.includes('PAM') || answer.includes('NGG')) score += 15;
      if (answer.includes('脱靶') || answer.includes('off-target')) score += 15;
      if (answer.length > 300) score += 10;
      return { score: Math.min(score, 90), breakdown: { mechanism: found.length >= 5, pam: answer.includes('PAM'), off_target: answer.includes('脱靶') }};
    }
  },
  "意识难题": {
    key_concepts: ["hard problem", "qualia", "感质", "功能主义", "泛心论", "IIT", "整合信息"],
    max: 100,
    rubric: (answer) => {
      let score = 0;
      const theories = ["功能主义", "泛心论", "IIT", "整合信息"];
      const found = theories.filter(t => answer.includes(t));
      score += found.length * 15;
      if (answer.includes('感质') || answer.includes('qualia') || answer.includes('主观体验')) score += 15;
      if (answer.includes('Chalmers') || answer.includes('查尔默斯') || answer.includes('hard problem')) score += 15;
      if (answer.length > 400) score += 10;
      return { score: Math.min(score, 100), breakdown: { theories: found.length, qualia: answer.includes('感质') || answer.includes('qualia'), depth: answer.length > 400 }};
    }
  },

  // === Instruction Following ===
  "格式遵循": {
    max: 60,
    rubric: (answer) => {
      let score = 0;
      const a = answer.trim();
      // Check if it's valid JSON array
      try {
        const parsed = JSON.parse(a);
        if (Array.isArray(parsed) && parsed.length === 5) score += 30;
        else if (Array.isArray(parsed)) score += 15;
        // Check each item has required fields
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(item => item.name && item.color && item.taste);
          score += Math.min(valid.length * 6, 30);
        }
      } catch(e) {
        // Not valid JSON, partial credit
        if (a.includes('[') && a.includes(']')) score += 10;
        if (a.includes('name') || a.includes('color') || a.includes('taste')) score += 10;
      }
      return { score: Math.min(score, 60), breakdown: { json_valid: score >= 30, array_correct: score >= 30, fields_complete: score >= 50 }};
    }
  },
  "多步指令": {
    max: 75,
    rubric: (answer) => {
      let score = 0;
      const n = normAnswer(answer);
      const steps = ['1', '2', '3', '4', '5'];
      const found = steps.filter(s => n.includes(s+')') || n.includes(s+'.') || n.includes('步骤'+s) || n.includes('step'+s));
      score += found.length * 10;
      // Check for specific content
      if (answer.includes('*') || answer.includes('△') || answer.includes('^')) score += 10; // triangle
      // Check for numbers that make sense
      if (answer.includes('3') && answer.includes('5') && answer.includes('7')) score += 5; // primes
      if (answer.includes('15') || answer.includes('1111') || answer.includes('1110')) score += 5; // binary
      if (answer.length > 100) score += 10;
      return { score: Math.min(score, 75), breakdown: { steps_present: found.length, triangle: answer.includes('*'), reasoning: answer.length > 100 }};
    }
  },
  "精确格式": {
    max: 90,
    rubric: (answer) => {
      let score = 0;
      const a = answer;
      const n = normAnswer(answer);
      // Check for markdown table
      if (a.includes('|') && a.includes('---')) score += 20;
      // Check for language names
      if (n.includes('python')) score += 10;
      if (n.includes('javascript') || n.includes('js')) score += 10;
      if (n.includes('rust')) score += 10;
      // Check for required columns
      const cols = ['类型', 'GC', '并发', '适用'];
      const found = cols.filter(c => a.includes(c));
      score += found.length * 10;
      // Check brevity (each cell ≤ 10 chars is hard to verify, but table format is good)
      if (a.split('|').length > 10) score += 10;
      return { score: Math.min(score, 90), breakdown: { table_format: a.includes('|'), languages: score >= 40, columns: found.length, completeness: a.split('|').length > 10 }};
    }
  },
  "自我约束": {
    max: 100,
    rubric: (answer) => {
      let score = 0;
      const lines = answer.split('\n').filter(l => l.trim().length > 0);
      // Check word count ≈ 200
      const charCount = answer.replace(/\s/g, '').length;
      if (charCount > 100 && charCount < 400) score += 15;
      // Check no '的' (hard constraint)
      const rawAnswer = answer;
      const deCount = (rawAnswer.match(/的/g) || []).length;
      if (deCount === 0) score += 25;
      else if (deCount <= 3) score += 10;
      // Check for self-report of violations
      if (n.includes('违反') || n.includes('约束') || n.includes('的字') || n.includes('violation')) score += 20;
      // Check sentence structure (12 chars per sentence is hard to verify)
      if (n.includes('比喻') || n.includes('像') || n.includes('如') || n.includes('似')) score += 15;
      if (answer.length > 100) score += 15;
      // Bonus for actually trying all constraints
      if (deCount <= 1 && n.includes('约束')) score += 10;
      return { score: Math.min(score, 100), breakdown: { length: charCount > 100, no_de: deCount === 0, self_report: answer.includes('违反') || answer.includes('约束'), metaphor: answer.includes('比喻') || answer.includes('像') }};
    }
  },

  // === Long Context ===
  "信息提取": {
    max: 60,
    rubric: (answer) => {
      let score = 0;
      const n = normAnswer(answer);
      if (n.includes('Guido') || answer.includes('guido') || answer.includes('吉多') || answer.includes('范罗苏姆')) score += 20;
      if (answer.includes('可读') || answer.includes('readab')) score += 20;
      if (answer.includes('面向对象') || answer.includes('命令式') || answer.includes('函数式') || answer.includes('object')) score += 20;
      return { score: Math.min(score, 60), breakdown: { creator: answer.includes('Guido'), philosophy: answer.includes('可读'), paradigms: answer.includes('面向对象') }};
    }
  },
  "长文总结": {
    max: 75,
    rubric: (answer) => {
      let score = 0;
      const points = ['独立部署', '技术栈', '故障隔离', '复杂性', '数据一致', 'DevOps', '分布式单体'];
      const found = points.filter(p => answer.includes(p));
      score += Math.min(found.length * 8, 40);
      // Check for counter-argument
      if (answer.includes('分布式单体') || answer.includes('初创') || answer.includes('反模式') || answer.includes('过早')) score += 20;
      if (answer.length > 100) score += 15;
      return { score: Math.min(score, 75), breakdown: { key_points: found.length, counter_argument: answer.includes('分布式单体') || answer.includes('初创'), depth: answer.length > 100 }};
    }
  },
  "矛盾检测": {
    max: 90,
    rubric: (answer) => {
      let score = 0;
      const contradictions = [
        ['高端', '大众'], ['利润', '增长'], ['品质', '速度'],
        ['不做低端', '入门级'], ['不牺牲', '速度比完美']
      ];
      const found = contradictions.filter(([a, b]) => answer.includes(a) && answer.includes(b));
      score += found.length * 15;
      if (answer.length > 200) score += 15;
      return { score: Math.min(score, 90), breakdown: { contradictions_found: found.length, detail: answer.length > 200 }};
    }
  },
  "跨文档推理": {
    max: 100,
    rubric: (answer) => {
      let score = 0;
      const terms = ['增长', '留存', 'NPS', '烧钱', '毛利率', '技术债', '竞品', '融资', '跑道'];
      const found = terms.filter(t => answer.includes(t));
      score += Math.min(found.length * 8, 50);
      // Check for clear recommendation
      if (answer.includes('投资') || answer.includes('不建议') || answer.includes('谨慎') || answer.includes('推荐')) score += 20;
      // Check for reasoning
      if (answer.length > 300) score += 20;
      // Check for balanced analysis
      if ((answer.includes('优势') || answer.includes('积极')) && (answer.includes('风险') || answer.includes('问题'))) score += 10;
      return { score: Math.min(score, 100), breakdown: { data_coverage: found.length, recommendation: answer.includes('投资') || answer.includes('建议'), analysis: answer.length > 300, balanced: (answer.includes('优势') || answer.includes('积极')) && (answer.includes('风险') || answer.includes('问题')) }};
    }
  }
};

// Auto-score function
function autoScore(answer, questionName) {
  const ref = REF_ANSWERS[questionName];
  if (!ref) return null;
  const result = ref.rubric(answer || '');
  return {
    total_score: result.score,
    max_score: ref.max,
    breakdown: result.breakdown,
    comment: `自动评分: ${result.score}/${ref.max}`,
    auto: true
  };
}

// Check if a question has auto-scoring
function hasAutoScore(questionName) {
  return !!REF_ANSWERS[questionName];
}
