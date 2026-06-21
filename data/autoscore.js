// Auto-scoring module for objective LLM evaluation questions
// Provides reference answers and scoring functions for: code_algo, reasoning, instruction
// Knowledge, Chinese, Writing, Creative, Safety, Long Context are NOT auto-scored.

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
      return { score: Math.min(score, 60), breakdown: { algorithm: score >= 20, complexity: a.includes('o(n)'), implementation: answer.includes('def '), quality: answer.length > 200 } };
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
      return { score: Math.min(score, 75), breakdown: { class_design: score >= 20, data_structure: a.includes('ordereddict') || a.includes('linked'), methods: answer.includes('def get'), complexity: a.includes('o(1)') } };
    }
  },
  "最长递增子序列": {
    key_concepts: ["O(nlogn)", "二分查找", "binary search", "动态规划", "patience sorting", "LIS"],
    reference: "使用二分查找+贪心的O(nlogn)解法。维护一个tails数组，对每个新元素用二分查找找到第一个>=它的位置替换。patience sorting是等价思路。",
    code_patterns: ["bisect", "import bisect", "tails", "dp", "O(nlogn)", "O(n log n)"],
    max: 90,
    rubric: (answer) => {
      let score = 0;
      const a = answer.toLowerCase();
      const n = normAnswer(answer);
      // Check for algorithm complexity mention
      if (n.includes('o(nlogn)') || n.includes('o(nlogn)') || n.includes('o(n*logn)') || n.includes('o(n·logn)') || n.includes('nlogn') || n.includes('nlog') || n.includes('logn')) score += 15;
      // Check for binary search approach
      if (n.includes('二分查找') || n.includes('binarysearch') || n.includes('bisect')) score += 15;
      // Check for dynamic programming mention
      if (n.includes('动态规划') || n.includes('dynamicprogramming') || n.includes('dp') || n.includes('dp[')) score += 10;
      // Check for patience sorting or tails array
      if (n.includes('patiencesorting') || n.includes('耐心排序') || n.includes('tails') || n.includes('tail[')) score += 10;
      // Check for O(n²) comparison or mention
      if (n.includes('o(n²)') || n.includes('o(n^2)') || n.includes('on2)') || n.includes('平方')) score += 5;
      // Check for code implementation
      if (answer.includes('def ') || answer.includes('class ')) score += 10;
      if (answer.includes('return') && answer.includes('len')) score += 5;
      // Check for explanation quality
      if (answer.length > 400) score += 10;
      if (n.includes('维护') || n.includes('替换') || n.includes('查找第一个')) score += 5;
      // Bonus for full code with comments
      const codeLines = (answer.match(/\n/g) || []).length;
      if (codeLines > 10) score += 5;
      return { score: Math.min(score, 90), breakdown: { complexity: n.includes('nlogn') || n.includes('logn'), binary_search: n.includes('二分') || n.includes('bisect'), dp_mention: n.includes('动态规划') || n.includes('dp'), implementation: answer.includes('def '), explanation: answer.length > 400 } };
    }
  },
  "带TTL的LFU缓存": {
    key_concepts: ["OrderedDict", "defaultdict", "双链表", "哈希", "TTL", "过期", "time.time", "频率淘汰", "O(1)"],
    reference: "LFU+TTL缓存：维护频率→节点的映射 + 哈希表存key→节点。get/put为O(1)。TTL用time.time()比较过期时间。淘汰最低频率+最久未用的节点。",
    code_patterns: ["class LFUCache", "def get", "def put", "time.time", "ttl", "defaultdict", "OrderedDict", "freq"],
    max: 100,
    rubric: (answer) => {
      let score = 0;
      const a = answer.toLowerCase();
      const n = normAnswer(answer);
      // Check for data structure approach
      if (n.includes('ordereddict') || n.includes('defaultdict') || n.includes('双链表') || n.includes('doubly') || n.includes('linkedlist')) score += 15;
      // Check for hash + linked list or OrderedDict combination
      if ((n.includes('dict') || n.includes('hash') || n.includes('哈希')) && (n.includes('链表') || n.includes('linked') || n.includes('ordered'))) score += 10;
      // Check for TTL / expiry mechanism
      if (n.includes('ttl') || n.includes('time.time') || n.includes('过期') || n.includes('expire') || n.includes('timestamp')) score += 15;
      // Check for frequency eviction strategy
      if (n.includes('频率') || n.includes('freq') || n.includes('freq_count') || n.includes('淘汰') || n.includes('evict') || n.includes('最低频')) score += 10;
      // Check for O(1) complexity claim
      if (n.includes('o(1)')) score += 10;
      // Check for class definition
      if (answer.includes('class') && (answer.includes('LFU') || answer.includes('lfu') || answer.includes('cache'))) score += 10;
      // Check for get and put methods
      if (answer.includes('def get') && answer.includes('def put')) score += 10;
      // Check for TTL implementation detail
      if (a.includes('time.time()') || n.includes('time.monotonic') || n.includes('expire_time') || n.includes('created_at')) score += 5;
      // Check for test cases or usage examples
      if (n.includes('test') || n.includes('测试') || n.includes('示例') || n.includes('example') || n.includes('assert')) score += 5;
      // Check for capacity constraint
      if (n.includes('capacity') || n.includes('容量') || n.includes('max_size')) score += 5;
      // Length and completeness
      if (answer.length > 600) score += 5;
      return { score: Math.min(score, 100), breakdown: { data_structure: n.includes('ordereddict') || n.includes('linked'), ttl: n.includes('ttl') || n.includes('time.time'), frequency: n.includes('频率') || n.includes('freq'), complexity: n.includes('o(1)'), implementation: answer.includes('def get'), tests: n.includes('test') || n.includes('测试') } };
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
      if (norm.includes('验证') || norm.includes('代入')) score += 5;
      if (answer.length > 200) score += 5;
      return { score: Math.min(score, 60), breakdown: { correct_answer: norm.includes('42'), formula: norm.includes('n^2+n') || norm.includes('n(n+1)'), reasoning: norm.includes('差') || norm.includes('递增'), detail: answer.length > 200 } };
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
      return { score: Math.min(score, 75), breakdown: { correct_answer: answer.includes('17'), steps: answer.includes('回') || answer.includes('返回'), detail: answer.length > 200 } };
    }
  },
  "4门蒙提霍尔": {
    key_concepts: ["3/8", "条件概率", "贝叶斯", "换门", "四门", "4 doors", "conditional probability"],
    reference: "4门蒙提霍尔：初始选对概率1/4，选错3/4。主持人打开2扇有山羊的门后，换门中奖概率 = 选错概率 × (换到正确门的概率) = 3/4 × 2/3 = 3/8。或者用条件概率证明：换门后存活概率 = P(初始选错)×P(剩余门中有车|选错) = 3/4 × 2/3 = 3/8。不换门概率为1/4=2/8，所以换门略优。",
    expected_answer: "3/8",
    max: 90,
    rubric: (answer) => {
      let score = 0;
      const a = answer.toLowerCase();
      const n = normAnswer(answer);
      // Check for correct probability 3/8
      if (n.includes('3/8') || answer.includes('37.5') || answer.includes('百分之三十七')) score += 30;
      // Check for initial probability 1/4
      if (n.includes('1/4') || n.includes('25%') || n.includes('四分之一')) score += 15;
      // Check for conditional probability or Bayesian approach
      if (n.includes('条件概率') || n.includes('贝叶斯') || n.includes('bayes') || n.includes('conditional')) score += 15;
      // Check for multi-door reasoning (主持人 opens 2 doors)
      if (n.includes('主持人') || n.includes('host') || n.includes('monty')) score += 5;
      if (n.includes('打开') || n.includes('open') || n.includes('揭示')) score += 5;
      // Check for comparison with 3-door version
      if (n.includes('3门') || n.includes('三门') || n.includes('3-door') || n.includes('经典')) score += 5;
      // Check for detailed explanation
      if (answer.length > 300) score += 15;
      return { score: Math.min(score, 90), breakdown: { correct_prob: answer.includes('3/8'), initial_prob: answer.includes('1/4'), method: answer.includes('条件概率') || answer.includes('贝叶斯'), explanation: answer.length > 300 } };
    }
  },
  "100囚犯与灯泡变体": {
    key_concepts: ["灯泡", "计数器", "指定计数者", "开关灯", "策略", "正确性证明", "期望时间", "light bulb", "counter", "strategy", "proof"],
    reference: "100囚犯灯泡变体：指定一名计数者(countdown prisoner)。其他人：首次进入且灯灭时开灯(最多开灯一次)。计数者：每次进入且灯亮时关灯并计数+1。当计数达到99时宣布所有人来过。正确性：每人最多贡献1次计数，不会多计。期望时间约O(n² log n)量级。",
    max: 100,
    rubric: (answer) => {
      let score = 0;
      const a = answer.toLowerCase();
      const n = normAnswer(answer);
      // Check for strategy design
      if (n.includes('策略') || n.includes('strategy') || n.includes('方案') || n.includes('方法')) score += 15;
      // Check for correctness proof (no false alarm)
      if (n.includes('证明') || n.includes('proof') || n.includes('正确性') || n.includes('不会误报') || n.includes('不会多计')) score += 15;
      // Check for light bulb / switch concept
      if (n.includes('灯') || n.includes('灯泡') || n.includes('light') || n.includes('bulb') || n.includes('开关') || n.includes('switch')) score += 10;
      // Check for counter / designated prisoner role
      if (n.includes('计数') || n.includes('counter') || n.includes('指定') || n.includes('记录') || n.includes('角色')) score += 10;
      // Check for expected time analysis
      if (n.includes('期望') || n.includes('expected') || n.includes('平均') || n.includes('数量级') || n.includes('时间复杂')) score += 10;
      // Check for 2 state changes constraint
      if (n.includes('2次') || n.includes('两次') || n.includes('最多') || n.includes('限制')) score += 5;
      // Check for code or pseudocode
      if (answer.includes('def ') || answer.includes('for ') || answer.includes('while ') || answer.includes('if ')) score += 10;
      // Check for explanation depth
      if (answer.length > 500) score += 10;
      // Check for counting to 99
      if (n.includes('99') || n.includes('计数到')) score += 5;
      // Check for initial state unknown handling
      if (n.includes('初始') || n.includes('未知') || n.includes('unknown') || n.includes('initial')) score += 5;
      // Check for 100 prisoners context
      if (n.includes('100') && (n.includes('囚犯') || n.includes('prisoner') || n.includes('犯人'))) score += 5;
      return { score: Math.min(score, 100), breakdown: { strategy: n.includes('策略') || n.includes('方案'), proof: n.includes('证明') || n.includes('正确性'), light_bulb: n.includes('灯') || n.includes('light'), counter: n.includes('计数') || n.includes('counter'), expected_time: n.includes('期望') || n.includes('expected'), explanation: answer.length > 500 } };
    }
  },

  // === Instruction Following ===
  "严格JSON输出": {
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
      } catch (e) {
        // Not valid JSON, partial credit
        if (a.includes('[') && a.includes(']')) score += 10;
        if (a.includes('name') || a.includes('color') || a.includes('taste')) score += 10;
      }
      return { score: Math.min(score, 60), breakdown: { json_valid: score >= 30, array_correct: score >= 30, fields_complete: score >= 50 } };
    }
  },
  "多步指令": {
    max: 75,
    rubric: (answer) => {
      let score = 0;
      const n = normAnswer(answer);
      const steps = ['1', '2', '3', '4', '5'];
      const found = steps.filter(s => n.includes(s + ')') || n.includes(s + '.') || n.includes('步骤' + s) || n.includes('step' + s));
      score += found.length * 10;
      // Check for specific content
      if (answer.includes('*') || answer.includes('△') || answer.includes('^')) score += 10; // triangle
      // Check for numbers that make sense
      if (answer.includes('3') && answer.includes('5') && answer.includes('7')) score += 5; // primes
      if (answer.includes('15') || answer.includes('1111') || answer.includes('1110')) score += 5; // binary
      if (answer.length > 100) score += 10;
      return { score: Math.min(score, 75), breakdown: { steps_present: found.length, triangle: answer.includes('*'), reasoning: answer.length > 100 } };
    }
  },
  "精确格式约束": {
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
      // Check row count (3 languages = 3 data rows)
      if (a.split('|').length > 10) score += 10;
      return { score: Math.min(score, 90), breakdown: { table_format: a.includes('|'), languages: score >= 40, columns: found.length, completeness: a.split('|').length > 10 } };
    }
  },
  "不可能约束组合": {
    max: 100,
    rubric: (answer) => {
      let score = 0;
      const a = answer;
      const n = normAnswer(answer);
      const lines = answer.split('\n').filter(l => l.trim().length > 0);
      // Check ALIGNMENT acrostic (first letter of each line)
      const firstLetters = lines.map(l => l.trim().charAt(0).toLowerCase()).join('');
      if (firstLetters.includes('alignment')) score += 20;
      else if (n.includes('alignment')) score += 10;
      // Check for no digits
      const digitCount = (answer.match(/\d/g) || []).length;
      if (digitCount === 0) score += 15;
      else if (digitCount <= 2) score += 5;
      // Check for rhyme pattern (AABB) — look for repeated end chars
      if (lines.length >= 4) {
        const endings = lines.slice(0, 4).map(l => l.trim().charAt(l.trim().length - 1));
        if (endings[0] === endings[1] && endings[2] === endings[3]) score += 10;
      }
      // Check for self-report of violations (honesty)
      if (n.includes('违反') || n.includes('约束') || n.includes('violation') || n.includes('无法满足') || n.includes('冲突')) score += 20;
      // Check for constraint conflict acknowledgment
      if (n.includes('冲突') || n.includes('矛盾') || n.includes('不可能') || n.includes('conflict')) score += 10;
      // Check for poem content (AI alignment theme)
      if (n.includes('对齐') || n.includes('alignment') || n.includes('ai') || n.includes('智能')) score += 10;
      // Length check
      if (answer.length > 200) score += 15;
      return { score: Math.min(score, 100), breakdown: { acrostic: firstLetters.includes('alignment'), no_digits: digitCount === 0, rhyme: lines.length >= 4, honesty: n.includes('违反') || n.includes('冲突'), explanation: answer.length > 200 } };
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
