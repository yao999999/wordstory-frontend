import { useState, useEffect, useRef, useCallback } from 'react'

// ==================== API 配置 ====================
const getApiUrl = () => {
  const urlParams = new URLSearchParams(window.location.search)
  const apiParam = urlParams.get('api')
  if (apiParam) return apiParam
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  if (window.location.hostname === 'localhost') return 'http://localhost:3001'
  return ''
}
const API = getApiUrl()

// ==================== 类型定义 ====================
interface WordbankInfo {
  id: string
  name: string
  count: number
}

interface WordbankCategory {
  category: string
  wordbanks: WordbankInfo[]
}

interface WordResult {
  index: number
  word: string
  phonetic: string
  pos: string
  meaning: string
  sentence: string
  allMeanings: string
  etymology: string
  derivatives: string
}

interface BrowseWord {
  word: string
  phonetic: string
  pos: string
  meaning: string
  allMeanings: string
  etymology: string
  derivatives: string
}

interface SearchResult {
  word: string
  phonetic: string
  pos: string
  meaning: string
  bankId: string
  bankName: string
  matchType: 'word' | 'meaning'
}

interface GenerateResult {
  id: string
  timestamp: number
  wordbank: { id: string; name: string }
  workInfo: { title: string; type: string; characters?: string; plot?: string }
  words: WordResult[]
}

interface Favorites {
  [key: string]: WordResult[]
}

// 每日一词
interface DailyWord {
  word: string
  phonetic: string
  pos: string
  meaning: string
  sentence: string
  etymology: string
  derivatives: string
}

// 测验相关
interface QuizQuestion {
  question: string
  options: string[]
  answer: number
  word: string
  meaning: string
}

// 词根
interface RootInfo {
  root: string
  meaning: string
  count: number
  words?: { word: string; meaning: string }[]
}

// 统计数据
interface StatsSummary {
  totalLearned: number
  dailyStreak: number
  todayWordCount: number
  weekData: { day: string; count: number }[]
  achievements: Achievement[]
}

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  unlocked: boolean
  unlockedAt?: string
}

// ==================== 常量 ====================
const BROWSE_MODE_BANKS = ['primary', 'middle', 'high', 'cet4', 'cet6', 'postgraduate', 'ielts', 'toefl', 'gre', 'sat', 'pte', 'bec']
const STORY_MODE_BANKS = ['ielts', 'cet4', 'cet6', 'gre', 'toefl']

// ==================== 本地存储工具 ====================
const STORAGE_KEYS = {
  HISTORY: 'wordstory_history',
  FAVORITES: 'wordstory_favorites',
  DARK_MODE: 'wordstory_dark_mode',
  LEARNED_WORDS: 'wordstory_learned_words',
  DAILY_STREAK: 'wordstory_daily_streak',
  LAST_STUDY_DATE: 'wordstory_last_study_date',
  TODAY_WORD_COUNT: 'wordstory_today_word_count',
  TODAY_DATE: 'wordstory_today_date',
}

const saveHistory = (history: GenerateResult[]) => localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history))
const loadHistory = (): GenerateResult[] => { try { const d = localStorage.getItem(STORAGE_KEYS.HISTORY); return d ? JSON.parse(d) : [] } catch { return [] } }
const saveFavorites = (favorites: Favorites) => localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites))
const loadFavorites = (): Favorites => { try { const d = localStorage.getItem(STORAGE_KEYS.FAVORITES); return d ? JSON.parse(d) : {} } catch { return {} } }
const loadLearnedWords = (): Set<string> => { try { const d = localStorage.getItem(STORAGE_KEYS.LEARNED_WORDS); return d ? new Set(JSON.parse(d)) : new Set() } catch { return new Set() } }
const saveLearnedWords = (words: Set<string>) => localStorage.setItem(STORAGE_KEYS.LEARNED_WORDS, JSON.stringify([...words]))

// ==================== 工具函数 ====================
function highlightWord(sentence: string, word: string): React.ReactNode {
  const regex = new RegExp(`(${word})`, 'gi')
  const parts = sentence.split(regex)
  return parts.map((part, i) =>
    part.toLowerCase() === word.toLowerCase() ? <span key={i} className="font-bold text-indigo-600 dark:text-indigo-400">{part}</span> : part
  )
}

function formatForCopy(words: WordResult[]): string {
  return words.map(w => `${w.index}. ${w.word} ${w.phonetic} ${w.pos} ${w.meaning}\n${w.sentence}`).join('\n\n')
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0]
}

// ==================== 撒花动画 ====================
function triggerConfetti() {
  const colors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#01a3a4', '#f368e0']
  for (let i = 0; i < 60; i++) {
    const el = document.createElement('div')
    el.className = 'confetti-piece'
    el.style.left = Math.random() * 100 + 'vw'
    el.style.width = (Math.random() * 10 + 5) + 'px'
    el.style.height = (Math.random() * 10 + 5) + 'px'
    el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
    el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px'
    el.style.animationDuration = (Math.random() * 2 + 2) + 's'
    el.style.animationDelay = (Math.random() * 0.5) + 's'
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 4000)
  }
}

// ==================== 音效 ====================
function playCorrectSound() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  } catch { /* ignore */ }
}

function playWrongSound() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(300, ctx.currentTime)
    osc.frequency.setValueAtTime(200, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch { /* ignore */ }
}

// ==================== 收藏弹窗组件 ====================
interface FavoritesModalProps {
  favorites: Favorites
  onClose: () => void
  playAudio: (word: string, accent: 'us' | 'uk') => void
}

function FavoritesModal({ favorites, onClose, playAudio }: FavoritesModalProps) {
  const [expandedWords, setExpandedWords] = useState<Set<string>>(new Set())
  const toggleExpand = (wordKey: string) => {
    const newExpanded = new Set(expandedWords)
    if (newExpanded.has(wordKey)) newExpanded.delete(wordKey)
    else newExpanded.add(wordKey)
    setExpandedWords(newExpanded)
  }
  const hasDetail = (word: WordResult) => word.allMeanings || word.etymology || word.derivatives

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">⭐ 我的收藏</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
        </div>
        <div className="overflow-y-auto max-h-[60vh] p-4">
          {Object.keys(favorites).length === 0 ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">暂无收藏</div>
          ) : (
            Object.entries(favorites).map(([key, words]) => (
              <div key={key} className="mb-6">
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 px-2">{key}</h4>
                <div className="space-y-2">
                  {words.map((word, idx) => {
                    const wordKey = `${key}_${idx}`
                    const isExpanded = expandedWords.has(wordKey)
                    const showExpand = hasDetail(word)
                    return (
                      <div key={idx} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors" onClick={() => showExpand && toggleExpand(wordKey)}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 dark:text-white">{word.word}</span>
                          <span className="text-sm text-gray-400 dark:text-gray-500 font-mono">{word.phonetic}</span>
                          <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 rounded-full">{word.pos}</span>
                          <span className="text-sm text-gray-600 dark:text-gray-300">{word.meaning}</span>
                          <div className="flex gap-1 ml-auto" onClick={e => e.stopPropagation()}>
                            <button onClick={() => playAudio(word.word, 'us')} className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-xs hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors" title="美式发音">🔊 美</button>
                            <button onClick={() => playAudio(word.word, 'uk')} className="px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded text-xs hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors" title="英式发音">🔊 英</button>
                          </div>
                          {showExpand && <span className="text-xs text-indigo-500 dark:text-indigo-400 ml-1">{isExpanded ? '▲' : '▼'}</span>}
                        </div>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{word.sentence}</p>
                        {isExpanded && showExpand && (
                          <div className="mt-3 space-y-2 border-t border-gray-200 dark:border-gray-600 pt-3">
                            {word.allMeanings && (
                              <div>
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">📖 全部词义</span>
                                <div className="bg-blue-50/60 dark:bg-blue-900/20 rounded-lg p-2 mt-1">
                                  {word.allMeanings.split(/[；;]/).filter(Boolean).map((m, i) => (
                                    <p key={i} className="text-xs text-gray-700 dark:text-gray-300 py-0.5">{m.trim()}</p>
                                  ))}
                                </div>
                              </div>
                            )}
                            {word.derivatives && (
                              <div>
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">🔄 词形变化</span>
                                <div className="bg-green-50/60 dark:bg-green-900/20 rounded-lg p-2 mt-1">
                                  <p className="text-xs text-gray-700 dark:text-gray-300">{word.derivatives}</p>
                                </div>
                              </div>
                            )}
                            {word.etymology && (
                              <div>
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">🧩 词根记忆</span>
                                <div className="bg-amber-50/60 dark:bg-amber-900/20 rounded-lg p-2 mt-1">
                                  <p className="text-xs text-gray-700 dark:text-gray-300">{word.etymology}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== 主应用 ====================
function App() {
  // ==================== 原有状态 ====================
  const [step, setStep] = useState(1)
  const [wordbankCategories, setWordbankCategories] = useState<WordbankCategory[]>([])
  const [selectedBank, setSelectedBank] = useState<string>('')
  const [wordCount, setWordCount] = useState(20)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [history, setHistory] = useState<GenerateResult[]>([])
  const [favorites, setFavorites] = useState<Favorites>({})
  const [showHistory, setShowHistory] = useState(false)
  const [showFavorites, setShowFavorites] = useState(false)
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set())
  const [expandedWords, setExpandedWords] = useState<Set<string>>(new Set())

  const [workTitle, setWorkTitle] = useState('')
  const [workType, setWorkType] = useState('小说')
  const [workCharacters, setWorkCharacters] = useState('')
  const [workPlot, setWorkPlot] = useState('')

  const [showCamera, setShowCamera] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [recognizedWords, setRecognizedWords] = useState<string>('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [browseMode, setBrowseMode] = useState(false)
  const [browseWords, setBrowseWords] = useState<BrowseWord[]>([])
  const [browseLetter, setBrowseLetter] = useState<string>('A')
  const [browseLetters, setBrowseLetters] = useState<string[]>([])
  const [browseExpandedWords, setBrowseExpandedWords] = useState<Set<string>>(new Set())

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ==================== 功能1: 深色模式 ====================
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DARK_MODE)
      return saved === 'true'
    } catch { return false }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DARK_MODE, String(darkMode))
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  const toggleDarkMode = () => setDarkMode(prev => !prev)

  // ==================== 功能2: 底部导航栏 ====================
  type TabType = 'home' | 'wordbank' | 'quiz' | 'profile' | 'settings'
  const [activeTab, setActiveTab] = useState<TabType>('home')

  // ==================== 功能3: 每日一词 ====================
  const [dailyWord, setDailyWord] = useState<DailyWord | null>(null)
  const [dailyWordFlipped, setDailyWordFlipped] = useState(false)
  const [dailyWordLoading, setDailyWordLoading] = useState(false)

  const fetchDailyWord = useCallback(async () => {
    setDailyWordLoading(true)
    try {
      const res = await fetch(API ? `${API}/api/daily-word` : '/api/daily-word')
      const data = await res.json()
      if (data.success) {
        setDailyWord(data.data)
      }
    } catch {
      // 使用默认数据
      setDailyWord({
        word: 'serendipity',
        phonetic: '/ˌserənˈdɪpəti/',
        pos: 'n.',
        meaning: '意外发现美好事物的能力；机缘巧合',
        sentence: 'Finding this cafe was pure serendipity — the best coffee I have ever had.',
        etymology: '源自波斯童话《三位锡兰王子》(The Three Princes of Serendip)',
        derivatives: 'serendipitous adj. 意外发现的；serendipitously adv.'
      })
    } finally {
      setDailyWordLoading(false)
    }
  }, [])

  // ==================== 功能4: 学习进度追踪 ====================
  const [learnedWords, setLearnedWords] = useState<Set<string>>(loadLearnedWords)

  const toggleLearnedWord = useCallback((word: string) => {
    setLearnedWords(prev => {
      const next = new Set(prev)
      if (next.has(word)) next.delete(word)
      else next.add(word)
      saveLearnedWords(next)
      return next
    })
  }, [])

  // ==================== 功能5: 每日打卡 + 连续火焰 ====================
  const [dailyStreak, setDailyStreak] = useState(() => {
    try { return parseInt(localStorage.getItem(STORAGE_KEYS.DAILY_STREAK) || '0') } catch { return 0 }
  })
  const [lastStudyDate, setLastStudyDate] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.LAST_STUDY_DATE) || ''
  })
  const [todayWordCount, setTodayWordCount] = useState(() => {
    const today = getTodayStr()
    const savedDate = localStorage.getItem(STORAGE_KEYS.TODAY_DATE) || ''
    if (savedDate === today) {
      try { return parseInt(localStorage.getItem(STORAGE_KEYS.TODAY_WORD_COUNT) || '0') } catch { return 0 }
    }
    return 0
  })

  const updateStudyStreak = useCallback(() => {
    const today = getTodayStr()
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    if (lastStudyDate === today) {
      // 今天已打卡，只增加今日词数
      const newCount = todayWordCount + 1
      setTodayWordCount(newCount)
      localStorage.setItem(STORAGE_KEYS.TODAY_WORD_COUNT, String(newCount))
      localStorage.setItem(STORAGE_KEYS.TODAY_DATE, today)
    } else if (lastStudyDate === yesterday) {
      // 昨天打卡了，连续+1
      const newStreak = dailyStreak + 1
      setDailyStreak(newStreak)
      setLastStudyDate(today)
      setTodayWordCount(1)
      localStorage.setItem(STORAGE_KEYS.DAILY_STREAK, String(newStreak))
      localStorage.setItem(STORAGE_KEYS.LAST_STUDY_DATE, today)
      localStorage.setItem(STORAGE_KEYS.TODAY_WORD_COUNT, '1')
      localStorage.setItem(STORAGE_KEYS.TODAY_DATE, today)
    } else {
      // 断签了，重新开始
      setDailyStreak(1)
      setLastStudyDate(today)
      setTodayWordCount(1)
      localStorage.setItem(STORAGE_KEYS.DAILY_STREAK, '1')
      localStorage.setItem(STORAGE_KEYS.LAST_STUDY_DATE, today)
      localStorage.setItem(STORAGE_KEYS.TODAY_WORD_COUNT, '1')
      localStorage.setItem(STORAGE_KEYS.TODAY_DATE, today)
    }
  }, [dailyStreak, lastStudyDate, todayWordCount])

  // ==================== 功能7: 测验闯关 ====================
  const [quizState, setQuizState] = useState<'select' | 'playing' | 'result'>('select')
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([])
  const [quizCurrentIdx, setQuizCurrentIdx] = useState(0)
  const [quizScore, setQuizScore] = useState(0)
  const [quizSelected, setQuizSelected] = useState<number | null>(null)
  const [quizStartTime, setQuizStartTime] = useState(0)
  const [quizEndTime, setQuizEndTime] = useState(0)

  // ==================== 功能8: 统计数据 ====================
  const [stats, setStats] = useState<StatsSummary | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(API ? `${API}/api/stats/summary` : '/api/stats/summary')
      const data = await res.json()
      if (data.success) {
        setStats(data.data)
      } else {
        // 使用本地数据
        setStats({
          totalLearned: learnedWords.size,
          dailyStreak,
          todayWordCount,
          weekData: Array.from({ length: 7 }, (_, i) => {
            const d = new Date(Date.now() - (6 - i) * 86400000)
            return { day: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()], count: i === 6 ? todayWordCount : Math.floor(Math.random() * 20) }
          }),
          achievements: [
            { id: 'first_word', name: '初学者', description: '学习第一个单词', icon: '🌱', unlocked: learnedWords.size >= 1 },
            { id: 'ten_words', name: '勤奋学生', description: '累计学习10个单词', icon: '📚', unlocked: learnedWords.size >= 10 },
            { id: 'fifty_words', name: '词汇达人', description: '累计学习50个单词', icon: '🏆', unlocked: learnedWords.size >= 50 },
            { id: 'hundred_words', name: '百词斩将', description: '累计学习100个单词', icon: '💎', unlocked: learnedWords.size >= 100 },
            { id: 'streak_7', name: '七日坚持', description: '连续打卡7天', icon: '🔥', unlocked: dailyStreak >= 7 },
            { id: 'streak_30', name: '月度冠军', description: '连续打卡30天', icon: '👑', unlocked: dailyStreak >= 30 },
            { id: 'quiz_perfect', name: '满分通关', description: '测验获得满分', icon: '⭐', unlocked: false },
          ]
        })
      }
    } catch {
      setStats({
        totalLearned: learnedWords.size,
        dailyStreak,
        todayWordCount,
        weekData: Array.from({ length: 7 }, (_, i) => {
          const d = new Date(Date.now() - (6 - i) * 86400000)
          return { day: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()], count: i === 6 ? todayWordCount : Math.floor(Math.random() * 20) }
        }),
        achievements: [
          { id: 'first_word', name: '初学者', description: '学习第一个单词', icon: '🌱', unlocked: learnedWords.size >= 1 },
          { id: 'ten_words', name: '勤奋学生', description: '累计学习10个单词', icon: '📚', unlocked: learnedWords.size >= 10 },
          { id: 'fifty_words', name: '词汇达人', description: '累计学习50个单词', icon: '🏆', unlocked: learnedWords.size >= 50 },
          { id: 'hundred_words', name: '百词斩将', description: '累计学习100个单词', icon: '💎', unlocked: learnedWords.size >= 100 },
          { id: 'streak_7', name: '七日坚持', description: '连续打卡7天', icon: '🔥', unlocked: dailyStreak >= 7 },
          { id: 'streak_30', name: '月度冠军', description: '连续打卡30天', icon: '👑', unlocked: dailyStreak >= 30 },
          { id: 'quiz_perfect', name: '满分通关', description: '测验获得满分', icon: '⭐', unlocked: false },
        ]
      })
    }
  }, [learnedWords.size, dailyStreak, todayWordCount])

  // ==================== 功能10: 词根词缀 ====================
  const [roots, setRoots] = useState<RootInfo[]>([])
  const [rootsLoading, setRootsLoading] = useState(false)
  const [expandedRoot, setExpandedRoot] = useState<string | null>(null)

  // ==================== 剧情背单词核心功能 ====================
  // 剧情单词卡片 - 继承WordResult的完整字段
  interface StoryWordCard {
    index: number
    word: string
    phonetic: string
    pos: string
    meaning: string
    sentence: string
    allMeanings: string      // 全部词义
    etymology: string        // 词根记忆
    derivatives: string      // 词形变化
    storyContext: string     // 剧情句子
    character?: string       // 涉及的角色
    day?: number             // 打卡天数
  }
  
  // 状态
  const [wordSource, setWordSource] = useState<'bank' | 'random' | 'manual' | 'photo'>('bank') // 单词来源
  const [selectedWordbankForStory, setSelectedWordbankForStory] = useState<string>('')
  const [customWords, setCustomWords] = useState<string>('') // 手动输入的单词
  const [artworkTitle, setArtworkTitle] = useState('') // 作品名称
  const [artworkCharacters, setArtworkCharacters] = useState('') // 人物线
  const [storyWords, setStoryWords] = useState<StoryWordCard[]>([])
  const [storyLoading, setStoryLoading] = useState(false)
  const [currentStoryDay, setCurrentStoryDay] = useState(1)
  const [wordsPerDay, setWordsPerDay] = useState(10)  // 每天单词数量，可选10/20/30
  const [showWordbankSelector, setShowWordbankSelector] = useState(false)
  const [showPhotoUpload, setShowPhotoUpload] = useState(false)
  
  // 生成剧情背单词内容
  const generateStoryWords = async (day: number) => {
    if (!artworkTitle.trim()) return
    setStoryLoading(true)
    try {
      let wordsToSend: Array<{
        word: string
        phonetic: string
        pos: string
        meaning: string
        allMeanings: string
        etymology: string
        derivatives: string
      }> = []
      
      if (wordSource === 'bank' && selectedWordbankForStory) {
        // 从词库获取单词
        const lettersRes = await fetch(API ? `${API}/api/wordbanks/${selectedWordbankForStory}/letters` : `/api/wordbanks/${selectedWordbankForStory}/letters`)
        const lettersData = await lettersRes.json()
        const letters = lettersData.data?.letters || lettersData.letters || []
        const allWords: any[] = []
        for (const letter of letters.slice(0, 5)) {
          const wordRes = await fetch(API ? `${API}/api/wordbanks/${selectedWordbankForStory}/letter/${letter}` : `/api/wordbanks/${selectedWordbankForStory}/letter/${letter}`)
          const wordData = await wordRes.json()
          const letterWords = wordData.data?.words || wordData.words || []
          if (letterWords) allWords.push(...letterWords)
          if (allWords.length >= day * wordsPerDay + wordsPerDay) break
        }
        const startIdx = (day - 1) * wordsPerDay
        wordsToSend = allWords.slice(startIdx, startIdx + wordsPerDay).map(w => ({
          word: w.word,
          phonetic: w.phonetic || '',
          pos: w.pos || '',
          meaning: w.meaning || '',
          allMeanings: w.allMeanings || '',
          etymology: w.etymology || '',
          derivatives: w.derivatives || ''
        }))
      } else if (wordSource === 'random') {
        // 随机从所有词库选词
        const banks = wordbankCategories.flatMap(c => c.wordbanks)
        if (banks.length === 0) {
          alert('词库加载中，请稍后重试')
          setStoryLoading(false)
          return
        }
        const randomBank = banks[Math.floor(Math.random() * banks.length)]
        const lettersRes = await fetch(API ? `${API}/api/wordbanks/${randomBank.id}/letters` : `/api/wordbanks/${randomBank.id}/letters`)
        const lettersData = await lettersRes.json()
        const letters = lettersData.data?.letters || lettersData.letters || []
        if (letters.length > 0) {
          const randomLetter = letters[Math.floor(Math.random() * letters.length)]
          const wordRes = await fetch(API ? `${API}/api/wordbanks/${randomBank.id}/letter/${randomLetter}` : `/api/wordbanks/${randomBank.id}/letter/${randomLetter}`)
          const wordData = await wordRes.json()
          const allWords = wordData.data?.words || wordData.words || []
          const shuffled = allWords.sort(() => Math.random() - 0.5)
          wordsToSend = shuffled.slice(0, wordsPerDay).map((w: any) => ({
            word: w.word,
            phonetic: w.phonetic || '',
            pos: w.pos || '',
            meaning: w.meaning || '',
            allMeanings: w.allMeanings || '',
            etymology: w.etymology || '',
            derivatives: w.derivatives || ''
          }))
        }
      } else if (wordSource === 'manual') {
        // 手动输入的单词
        const wordList = customWords.split(/[,，\n\s]+/).filter(w => w.trim())
        wordsToSend = wordList.slice((day - 1) * wordsPerDay, day * wordsPerDay).map(w => ({
          word: w.trim(),
          phonetic: '',
          pos: '',
          meaning: '',
          allMeanings: '',
          etymology: '',
          derivatives: ''
        }))
      }
      
      if (wordsToSend.length === 0) {
        alert('获取单词失败，请检查网络或选择其他词库')
        return
      }
      
      // 调用AI生成剧情
      const res = await fetch(API ? `${API}/api/generate-story-words` : '/api/generate-story-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artworkTitle: artworkTitle.trim(),
          artworkCharacters: artworkCharacters.trim(),
          words: wordsToSend,
          day,
          startIndex: (day - 1) * wordsPerDay + 1
        })
      })
      
      const data = await res.json()
      if (data.success && data.data) {
        // 合并AI生成的storyContext和原始单词数据
        const mergedWords = data.data.map((aiWord: any, idx: number) => {
          const originalWord = wordsToSend[idx] || {}
          return {
            index: (day - 1) * wordsPerDay + idx + 1,
            word: aiWord.word || originalWord.word || '',
            phonetic: originalWord.phonetic || '',
            pos: originalWord.pos || '',
            meaning: originalWord.meaning || aiWord.meaning || '',
            sentence: aiWord.sentence || '',
            allMeanings: originalWord.allMeanings || '',
            etymology: originalWord.etymology || '',
            derivatives: originalWord.derivatives || '',
            storyContext: aiWord.storyContext || '',
            character: aiWord.character,
            day
          }
        })
        setStoryWords(mergedWords)
        
        // 保存到历史记录
        const historyItem: GenerateResult = {
          id: `story-${Date.now()}`,
          timestamp: Date.now(),
          wordbank: { id: selectedWordbankForStory || 'custom', name: artworkTitle },
          workInfo: { title: artworkTitle, type: 'story', characters: artworkCharacters },
          words: mergedWords
        }
        const newHistory = [historyItem, ...history.slice(0, 49)]
        setHistory(newHistory)
        saveHistory(newHistory)
      } else {
        // 本地备用
        const chars = artworkCharacters ? artworkCharacters.split(/[,，、]+/).map(s => s.trim()).filter(Boolean) : ['主角']
        const localWords = wordsToSend.map((w, idx) => ({
          index: (day - 1) * wordsPerDay + idx + 1,
          word: w.word,
          phonetic: w.phonetic,
          pos: w.pos,
          meaning: w.meaning,
          sentence: '',
          allMeanings: w.allMeanings,
          etymology: w.etymology,
          derivatives: w.derivatives,
          storyContext: `${chars[idx % chars.length]}看着窗外，心中默念着"${w.word}"，${w.meaning || '这个词的含义在心中回荡'}。`,
          character: chars[idx % chars.length],
          day
        }))
        setStoryWords(localWords)
      }
    } catch (error) {
      console.error('生成剧情单词失败:', error)
    } finally {
      setStoryLoading(false)
    }
  }

  const fetchRoots = useCallback(async () => {
    setRootsLoading(true)
    try {
      const res = await fetch(API ? `${API}/api/roots` : '/api/roots')
      const data = await res.json()
      if (data.success) {
        setRoots(data.data)
      } else {
        // 默认数据
        setRoots([
          { root: 'dict', meaning: '说，言', count: 15, words: [{ word: 'dictate', meaning: 'v. 口述，命令' }, { word: 'dictionary', meaning: 'n. 词典' }, { word: 'predict', meaning: 'v. 预言' }] },
          { root: 'spect', meaning: '看', count: 12, words: [{ word: 'inspect', meaning: 'v. 检查' }, { word: 'spectator', meaning: 'n. 观众' }, { word: 'respect', meaning: 'n./v. 尊重' }] },
          { root: 'port', meaning: '拿，带', count: 18, words: [{ word: 'transport', meaning: 'v. 运输' }, { word: 'export', meaning: 'v. 出口' }, { word: 'import', meaning: 'v. 进口' }] },
          { root: 'ject', meaning: '扔，投', count: 10, words: [{ word: 'project', meaning: 'n. 项目' }, { word: 'reject', meaning: 'v. 拒绝' }, { word: 'inject', meaning: 'v. 注射' }] },
          { root: 'duct', meaning: '引导', count: 8, words: [{ word: 'conduct', meaning: 'v. 引导，指挥' }, { word: 'produce', meaning: 'v. 生产' }, { word: 'educate', meaning: 'v. 教育' }] },
          { root: 'vis/vid', meaning: '看', count: 14, words: [{ word: 'visible', meaning: 'adj. 可见的' }, { word: 'video', meaning: 'n. 视频' }, { word: 'evidence', meaning: 'n. 证据' }] },
        ])
      }
    } catch {
      setRoots([
        { root: 'dict', meaning: '说，言', count: 15, words: [{ word: 'dictate', meaning: 'v. 口述，命令' }, { word: 'dictionary', meaning: 'n. 词典' }, { word: 'predict', meaning: 'v. 预言' }] },
        { root: 'spect', meaning: '看', count: 12, words: [{ word: 'inspect', meaning: 'v. 检查' }, { word: 'spectator', meaning: 'n. 观众' }, { word: 'respect', meaning: 'n./v. 尊重' }] },
        { root: 'port', meaning: '拿，带', count: 18, words: [{ word: 'transport', meaning: 'v. 运输' }, { word: 'export', meaning: 'v. 出口' }, { word: 'import', meaning: 'v. 进口' }] },
      ])
    } finally {
      setRootsLoading(false)
    }
  }, [])

  // ==================== 功能9: AI流式输出 ====================
  const [streamingWords, setStreamingWords] = useState<WordResult[]>([])
  const [streamingProgress, setStreamingProgress] = useState('')

  // ==================== 初始化 ====================
  useEffect(() => {
    fetch(API ? `${API}/api/wordbanks` : '/api/wordbanks')
      .then(r => r.json())
      .then(d => setWordbankCategories(d.data || []))
    setHistory(loadHistory())
    setFavorites(loadFavorites())
    fetchDailyWord()
  }, [fetchDailyWord])

  // 切换到 profile 时刷新统计
  useEffect(() => {
    if (activeTab === 'profile') fetchStats()
  }, [activeTab, fetchStats])

  // 切换到 wordbank 时加载词根
  useEffect(() => {
    if (activeTab === 'wordbank' && roots.length === 0) fetchRoots()
  }, [activeTab, roots.length, fetchRoots])

  // ==================== 原有方法 ====================
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (videoRef.current) videoRef.current.srcObject = stream
      setShowCamera(true)
    } catch { setError('无法访问摄像头，请确保已授予权限') }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    setShowCamera(false)
  }

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(video, 0, 0)
      const imageData = canvas.toDataURL('image/jpeg')
      setCapturedImage(imageData)
      stopCamera()
      recognizeWords(imageData)
    }
  }

  const recognizeWords = async (imageData: string) => {
    setLoading(true)
    await new Promise(r => setTimeout(r, 1500))
    const mockWords = `abandon /əˈbændən/ v. 放弃\nability /əˈbɪləti/ n. 能力\nabsolute /ˈæbsəluːt/ adj. 绝对的\nabstract /ˈæbstrækt/ adj. 抽象的\nacademic /ˌækəˈdemɪk/ adj. 学术的`
    setRecognizedWords(mockWords)
    setLoading(false)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const imageData = event.target?.result as string
        setCapturedImage(imageData)
        recognizeWords(imageData)
      }
      reader.readAsDataURL(file)
    }
  }

  // ==================== 功能9: AI流式生成 ====================
  const handleGenerate = async () => {
    if (!selectedBank || !workTitle.trim()) {
      setError('请填写作品名称')
      return
    }
    setLoading(true)
    setError('')
    setStep(3)
    setStreamingWords([])
    setStreamingProgress('')
    try {
      const url = API ? `${API}/api/generate-stream` : '/api/generate-stream'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wordbankId: selectedBank,
          count: wordCount,
          workInfo: { title: workTitle, type: workType, characters: workCharacters, plot: workPlot }
        })
      })

      if (!res.ok || !res.body) {
        // 回退到非流式
        const fallbackRes = await fetch(API ? `${API}/api/generate` : '/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wordbankId: selectedBank,
            count: wordCount,
            workInfo: { title: workTitle, type: workType, characters: workCharacters, plot: workPlot }
          })
        })
        const data = await fallbackRes.json()
        if (data.success) {
          const newResult: GenerateResult = { id: Date.now().toString(), timestamp: Date.now(), ...data.data }
          setResult(newResult)
          const newHistory = [newResult, ...history].slice(0, 50)
          setHistory(newHistory)
          saveHistory(newHistory)
          setStep(4)
        } else {
          setError(data.message || '生成失败')
          setStep(2)
        }
        setLoading(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const allWords: WordResult[] = []
      const bankInfo = wordbankCategories.flatMap(c => c.wordbanks).find(b => b.id === selectedBank)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim()
            if (jsonStr === '[DONE]') continue
            try {
              const parsed = JSON.parse(jsonStr)
              if (parsed.type === 'word' && parsed.data) {
                const wordData = parsed.data
                const wordResult: WordResult = {
                  index: allWords.length + 1,
                  word: wordData.word || wordData,
                  phonetic: wordData.phonetic || '',
                  pos: wordData.pos || '',
                  meaning: wordData.meaning || '',
                  sentence: wordData.sentence || '',
                  allMeanings: wordData.allMeanings || '',
                  etymology: wordData.etymology || '',
                  derivatives: wordData.derivatives || '',
                }
                allWords.push(wordResult)
                setStreamingWords([...allWords])
                setStreamingProgress(`正在生成第 ${allWords.length}/${wordCount} 个单词...`)
              } else if (parsed.type === 'done' || parsed.success) {
                // 完成
              } else if (parsed.type === 'progress') {
                setStreamingProgress(parsed.message || `正在生成...`)
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }

      if (allWords.length > 0) {
        const newResult: GenerateResult = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          wordbank: { id: selectedBank, name: bankInfo?.name || selectedBank },
          workInfo: { title: workTitle, type: workType, characters: workCharacters, plot: workPlot },
          words: allWords
        }
        setResult(newResult)
        const newHistory = [newResult, ...history].slice(0, 50)
        setHistory(newHistory)
        saveHistory(newHistory)
        setStep(4)
      } else {
        setError('生成结果为空，请重试')
        setStep(2)
      }
    } catch (e: unknown) {
      setError('网络错误，请检查后端服务是否启动')
      setStep(2)
    } finally {
      setLoading(false)
      setStreamingProgress('')
    }
  }

  const handleReset = () => {
    setStep(1)
    setSelectedBank('')
    setWorkTitle('')
    setWorkCharacters('')
    setWorkPlot('')
    setResult(null)
    setError('')
    setRecognizedWords('')
    setCapturedImage(null)
    setSelectedWords(new Set())
    setShowHistory(false)
    setShowFavorites(false)
    setBrowseMode(false)
    setBrowseWords([])
    setBrowseLetter('A')
    setBrowseExpandedWords(new Set())
    setStreamingWords([])
    setStreamingProgress('')
  }

  const handleBackToWordbanks = () => {
    setBrowseMode(false)
    setSelectedBank('')
    setBrowseWords([])
    setBrowseLetter('A')
    setBrowseExpandedWords(new Set())
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (!query.trim()) { setSearchResults([]); setShowSearchResults(false); return }
    setShowSearchResults(true)
    setSearchLoading(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(API ? `${API}/api/search?q=${encodeURIComponent(query)}&limit=10` : `/api/search?q=${encodeURIComponent(query)}&limit=10`)
        const data = await response.json()
        if (data.success) setSearchResults(data.data)
      } catch { console.error('搜索失败') }
      finally { setSearchLoading(false) }
    }, 300)
  }

  const handleSearchResultClick = (result: SearchResult) => {
    setShowSearchResults(false)
    setSearchQuery('')
    setSelectedBank(result.bankId)
    setBrowseMode(true)
    setBrowseLetter(result.word.charAt(0).toUpperCase())
    loadBrowseWords(result.bankId)
  }

  const isBrowseModeBank = (bankId: string) => BROWSE_MODE_BANKS.includes(bankId)

  const loadBrowseWords = async (bankId: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(API ? `${API}/api/wordbanks/${bankId}/letters` : `/api/wordbanks/${bankId}/letters`)
      const data = await res.json()
      if (data.success) {
        const allWords: BrowseWord[] = []
        Object.values(data.data.wordsByLetter as Record<string, BrowseWord[]>).forEach(letterWords => allWords.push(...letterWords))
        setBrowseWords(allWords)
        setBrowseMode(true)
        const letters = data.data.letters as string[]
        setBrowseLetters(letters)
        if (letters.length > 0) setBrowseLetter(letters[0])
      } else { setError(data.message || '加载单词失败') }
    } catch { setError('网络错误，请检查后端服务是否启动') }
    finally { setLoading(false) }
  }

  const handleWordbankSelect = (bankId: string) => {
    setSelectedBank(bankId)
    if (isBrowseModeBank(bankId)) loadBrowseWords(bankId)
    else setStep(2)
  }

  const toggleBrowseWordExpand = (word: string) => {
    const newExpanded = new Set(browseExpandedWords)
    if (newExpanded.has(word)) newExpanded.delete(word)
    else newExpanded.add(word)
    setBrowseExpandedWords(newExpanded)
  }

  const getWordsByLetter = (letter: string): BrowseWord[] => {
    return browseWords.filter(w => w.word.toUpperCase().startsWith(letter.toUpperCase()))
  }

  const playAudio = (word: string, accent: 'us' | 'uk') => {
    const audio = new Audio(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${accent === 'us' ? '2' : '1'}`)
    audio.play().catch(() => {
      const fallbackAudio = new Audio(`https://ssl.gstatic.com/dictionary/static/sounds/oxford/${word.toLowerCase()}--_${accent}_1.mp3`)
      fallbackAudio.play().catch(() => alert('发音加载失败，请检查网络'))
    })
  }

  const toggleWordSelection = (wordKey: string) => {
    const newSelected = new Set(selectedWords)
    if (newSelected.has(wordKey)) newSelected.delete(wordKey)
    else newSelected.add(wordKey)
    setSelectedWords(newSelected)
  }

  const toggleWordExpand = (wordKey: string) => {
    const newExpanded = new Set(expandedWords)
    if (newExpanded.has(wordKey)) newExpanded.delete(wordKey)
    else newExpanded.add(wordKey)
    setExpandedWords(newExpanded)
  }

  const addToFavorites = () => {
    if (!result || selectedWords.size === 0) return
    const favKey = `${result.workInfo.title}_${result.wordbank.name}`
    const currentFavs = favorites[favKey] || []
    const wordsToAdd = result.words.filter(w => selectedWords.has(`${result.id}_${w.index}`))
    const newFavs = { ...favorites, [favKey]: [...currentFavs, ...wordsToAdd] }
    setFavorites(newFavs)
    saveFavorites(newFavs)
    setSelectedWords(new Set())
    alert(`已收藏 ${wordsToAdd.length} 个单词`)
  }

  const loadFromHistory = (item: GenerateResult) => {
    setResult(item)
    setStep(4)
    setShowHistory(false)
  }

  const deleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newHistory = history.filter(h => h.id !== id)
    setHistory(newHistory)
    saveHistory(newHistory)
  }

  // ==================== 功能4: 标记已学（带打卡） ====================
  const handleMarkLearned = (word: string) => {
    toggleLearnedWord(word)
    if (!learnedWords.has(word)) {
      updateStudyStreak()
    }
  }

  // ==================== 功能6: 检查是否全部已学 ====================
  const checkAllLearned = (words: BrowseWord[] | WordResult[]) => {
    const visibleWords = words.map(w => w.word)
    return visibleWords.every(w => learnedWords.has(w))
  }

  // ==================== 功能7: 测验方法 ====================
  const startQuiz = async (bankId: string) => {
    setLoading(true)
    try {
      const res = await fetch(API ? `${API}/api/quiz/${bankId}` : `/api/quiz/${bankId}`)
      const data = await res.json()
      if (data.success && data.data) {
        setQuizQuestions(data.data.slice(0, 10))
      } else {
        // 默认测验题
        setQuizQuestions([
          { question: 'abandon 的含义是？', options: ['放弃', '接受', '获得', '拒绝'], answer: 0, word: 'abandon', meaning: '放弃' },
          { question: 'abstract 的含义是？', options: ['具体的', '抽象的', '绝对的', '丰富的'], answer: 1, word: 'abstract', meaning: '抽象的' },
          { question: 'beneath 的含义是？', options: ['在...之上', '在...之下', '在...旁边', '在...对面'], answer: 1, word: 'beneath', meaning: '在...之下' },
          { question: 'capacity 的含义是？', options: ['能力，容量', '首都', '捕获', '帽子'], answer: 0, word: 'capacity', meaning: '能力，容量' },
          { question: 'decline 的含义是？', options: ['增加', '声明', '下降，拒绝', '装饰'], answer: 2, word: 'decline', meaning: '下降，拒绝' },
          { question: 'elaborate 的含义是？', options: ['简单的', '精心的，详尽的', '弹性的', '电子的'], answer: 1, word: 'elaborate', meaning: '精心的，详尽的' },
          { question: 'feasible 的含义是？', options: ['不可能的', '可行的', '灵活的', '可怕的'], answer: 1, word: 'feasible', meaning: '可行的' },
          { question: 'genuine 的含义是？', options: ['虚假的', '巨大的', '真正的', '一般的'], answer: 2, word: 'genuine', meaning: '真正的' },
          { question: 'hostile 的含义是？', options: ['友好的', '敌对的', '酒店的', '诚实的'], answer: 1, word: 'hostile', meaning: '敌对的' },
          { question: 'inevitable 的含义是？', options: ['可避免的', '不可避免的', '难以置信的', '不可见的'], answer: 1, word: 'inevitable', meaning: '不可避免的' },
        ])
      }
      setQuizState('playing')
      setQuizCurrentIdx(0)
      setQuizScore(0)
      setQuizSelected(null)
      setQuizStartTime(Date.now())
    } catch {
      // 默认测验题
      setQuizQuestions([
        { question: 'abandon 的含义是？', options: ['放弃', '接受', '获得', '拒绝'], answer: 0, word: 'abandon', meaning: '放弃' },
        { question: 'abstract 的含义是？', options: ['具体的', '抽象的', '绝对的', '丰富的'], answer: 1, word: 'abstract', meaning: '抽象的' },
        { question: 'beneath 的含义是？', options: ['在...之上', '在...之下', '在...旁边', '在...对面'], answer: 1, word: 'beneath', meaning: '在...之下' },
        { question: 'capacity 的含义是？', options: ['能力，容量', '首都', '捕获', '帽子'], answer: 0, word: 'capacity', meaning: '能力，容量' },
        { question: 'decline 的含义是？', options: ['增加', '声明', '下降，拒绝', '装饰'], answer: 2, word: 'decline', meaning: '下降，拒绝' },
        { question: 'elaborate 的含义是？', options: ['简单的', '精心的，详尽的', '弹性的', '电子的'], answer: 1, word: 'elaborate', meaning: '精心的，详尽的' },
        { question: 'feasible 的含义是？', options: ['不可能的', '可行的', '灵活的', '可怕的'], answer: 1, word: 'feasible', meaning: '可行的' },
        { question: 'genuine 的含义是？', options: ['虚假的', '巨大的', '真正的', '一般的'], answer: 2, word: 'genuine', meaning: '真正的' },
        { question: 'hostile 的含义是？', options: ['友好的', '敌对的', '酒店的', '诚实的'], answer: 1, word: 'hostile', meaning: '敌对的' },
        { question: 'inevitable 的含义是？', options: ['可避免的', '不可避免的', '难以置信的', '不可见的'], answer: 1, word: 'inevitable', meaning: '不可避免的' },
      ])
      setQuizState('playing')
      setQuizCurrentIdx(0)
      setQuizScore(0)
      setQuizSelected(null)
      setQuizStartTime(Date.now())
    } finally {
      setLoading(false)
    }
  }

  const handleQuizAnswer = (optionIdx: number) => {
    if (quizSelected !== null) return
    setQuizSelected(optionIdx)
    const isCorrect = optionIdx === quizQuestions[quizCurrentIdx].answer
    if (isCorrect) {
      setQuizScore(prev => prev + 1)
      playCorrectSound()
      // 标记为已学
      const word = quizQuestions[quizCurrentIdx].word
      if (!learnedWords.has(word)) {
        toggleLearnedWord(word)
        updateStudyStreak()
      }
    } else {
      playWrongSound()
    }

    setTimeout(() => {
      if (quizCurrentIdx < quizQuestions.length - 1) {
        setQuizCurrentIdx(prev => prev + 1)
        setQuizSelected(null)
      } else {
        setQuizEndTime(Date.now())
        setQuizState('result')
        // 完成测验时打卡
        updateStudyStreak()
        // 检查是否满分
        const finalScore = isCorrect ? quizScore + 1 : quizScore
        if (finalScore === quizQuestions.length) {
          triggerConfetti()
        }
      }
    }, 1000)
  }

  // ==================== 功能11: 分享功能 ====================
  const handleShare = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 750
    canvas.height = 1000
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 背景渐变
    const gradient = ctx.createLinearGradient(0, 0, 750, 1000)
    gradient.addColorStop(0, '#667eea')
    gradient.addColorStop(1, '#764ba2')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 750, 1000)

    // 装饰圆
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.beginPath()
    ctx.arc(600, 150, 200, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(100, 800, 150, 0, Math.PI * 2)
    ctx.fill()

    // Logo
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 48px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('WordStory', 375, 120)

    ctx.font = '24px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fillText('剧情背单词', 375, 160)

    // 分割线
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(100, 200)
    ctx.lineTo(650, 200)
    ctx.stroke()

    // 学习数据
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 36px sans-serif'
    ctx.fillText(`我今天学了 ${todayWordCount} 个单词`, 375, 280)

    ctx.font = '28px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    const streakText = dailyStreak >= 7 ? `🔥 连续打卡 ${dailyStreak} 天` : `连续打卡 ${dailyStreak} 天`
    ctx.fillText(streakText, 375, 340)

    // 精选单词
    const sampleWords = result ? result.words.slice(0, 3) : []
    if (sampleWords.length > 0) {
      ctx.font = '20px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.fillText('— 今日精选 —', 375, 420)

      sampleWords.forEach((w, i) => {
        const y = 480 + i * 100
        // 单词卡片背景
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        ctx.beginPath()
        ctx.roundRect(75, y - 30, 600, 80, 16)
        ctx.fill()

        ctx.fillStyle = '#fff'
        ctx.font = 'bold 28px sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText(w.word, 110, y + 5)

        ctx.font = '18px sans-serif'
        ctx.fillStyle = 'rgba(255,255,255,0.8)'
        ctx.fillText(`${w.phonetic}  ${w.pos} ${w.meaning}`, 110, y + 35)
      })
    }

    // 底部
    ctx.textAlign = 'center'
    ctx.font = '18px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillText('扫码加入 WordStory 一起背单词', 375, 920)

    // 下载
    const link = document.createElement('a')
    link.download = `wordstory-share-${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  // ==================== 渲染：首页（剧情背单词核心功能） ====================
  const renderHome = () => {
    // 渲染词库选择器
    const renderWordbankSelector = () => (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowWordbankSelector(false)}>
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl animate-fadeIn" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">选择要背的单词库</h3>
            <button onClick={() => setShowWordbankSelector(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl">✕</button>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {wordbankCategories.map(category => (
              category.wordbanks.map(bank => (
                <button
                  key={bank.id}
                  onClick={() => {
                    setSelectedWordbankForStory(bank.id)
                    setShowWordbankSelector(false)
                  }}
                  className={`p-4 rounded-xl text-left transition-all ${
                    selectedWordbankForStory === bank.id
                      ? 'bg-indigo-100 dark:bg-indigo-900/40 border-2 border-indigo-500'
                      : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">
                      {bank.id === 'cet4' ? '📘' : bank.id === 'cet6' ? '📗' : bank.id === 'ielts' ? '🎓' : bank.id === 'gre' ? '📕' : bank.id === 'toefl' ? '📙' : '📚'}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">{bank.name}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{bank.count} 词</div>
                </button>
              ))
            ))}
          </div>
        </div>
      </div>
    )

    // 渲染拍照上传弹窗
    const renderPhotoUpload = () => (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPhotoUpload(false)}>
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl animate-fadeIn" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">拍照识别单词</h3>
            <button onClick={() => setShowPhotoUpload(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl">✕</button>
          </div>

          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-8 text-center hover:border-indigo-400 transition-colors">
              <div className="text-5xl mb-3">📷</div>
              <p className="text-gray-500 dark:text-gray-400 mb-4">上传包含单词的图片，自动识别其中的单词</p>
              <label className="inline-block px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl font-medium cursor-pointer hover:shadow-lg transition-all">
                选择图片
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      // TODO: OCR识别功能 - 暂时placeholder
                      alert('OCR识别功能开发中，敬请期待！\n已选择文件：' + file.name)
                      setShowPhotoUpload(false)
                    }
                  }}
                />
              </label>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                💡 提示：支持拍照或从相册选择，图片越清晰识别效果越好。支持课本、试卷、单词表等多种场景。
              </p>
            </div>
          </div>
        </div>
      </div>
    )

    // 渲染剧情单词卡片
    const renderStoryWordCards = () => (
      <div className="h-full overflow-y-auto px-4 py-4 pb-8">
        {/* 剧情标题 */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              【D{currentStoryDay}打卡：NO.{((currentStoryDay - 1) * wordsPerDay + 1)}-NO.{Math.min(currentStoryDay * wordsPerDay, storyWords.length)}】
            </h2>
            <button
              onClick={() => {
                setWordSource('bank')
                setSelectedWordbankForStory('')
                setCustomWords('')
                setArtworkTitle('')
                setArtworkCharacters('')
                setStoryWords([])
                setCurrentStoryDay(1)
              }}
              className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              🔄 换一个
            </button>
          </div>
          <p className="text-sm text-indigo-600 dark:text-indigo-400">
            {artworkTitle}{artworkCharacters ? ` · ${artworkCharacters}` : ''} 的故事线
          </p>
        </div>
        
        {/* 单词卡片列表 */}
        <div className="space-y-4">
          {storyWords.map((card, idx) => {
            const hasDetail = card.allMeanings || card.etymology || card.derivatives
            const wordKey = `${artworkTitle}-${card.word}-${idx}`
            const isExpanded = expandedWords.has(wordKey)
            const isFavorite = favorites[artworkTitle]?.some(w => w.word === card.word)
            
            return (
            <div key={idx} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 animate-fadeIn" style={{ animationDelay: `${idx * 0.05}s` }}>
              {/* 单词头部 */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-2xl text-gray-900 dark:text-gray-100 font-black flex-shrink-0">{card.index}.</span>
                    <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{card.word}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{card.phonetic}</span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    <span className="text-indigo-500 dark:text-indigo-400">{card.pos}</span> {card.meaning}
                  </div>
                </div>
                {/* 发音按钮 */}
                <div className="flex gap-1">
                  <button
                    onClick={() => playAudio(card.word, 'us')}
                    className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-xs hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    title="美式发音"
                  >
                    🔊 美
                  </button>
                  <button
                    onClick={() => playAudio(card.word, 'uk')}
                    className="px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded text-xs hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                    title="英式发音"
                  >
                    🔊 英
                  </button>
                </div>
              </div>
              
              {/* 剧情句子 */}
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 rounded-xl p-4 border-l-4 border-pink-400">
                <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                  {card.storyContext.split(card.word).map((part, i, arr) => (
                    <span key={i}>
                      {part}
                      {i < arr.length - 1 && (
                        <span className="font-bold text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-900/40 px-1 rounded">{card.word}</span>
                      )}
                    </span>
                  ))}
                </p>
                {card.character && (
                  <p className="text-xs text-pink-500 dark:text-pink-400 mt-2">—— {card.character}</p>
                )}
              </div>
              
              {/* 详细信息：全部词义、词根记忆、词形变化 - 默认折叠 */}
              {hasDetail && (
                <div className="mt-3">
                  <button
                    onClick={() => toggleWordExpand(wordKey)}
                    className="w-full flex items-center justify-center gap-1 py-2 text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                  >
                    {isExpanded ? '▲ 收起详情' : '▼ 展开详情（词义/词根/词形变化）'}
                  </button>
                  {isExpanded && (
                    <div className="mt-2 space-y-2">
                      {card.allMeanings && (
                        <div>
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">📖 全部词义</span>
                          <div className="bg-blue-50/60 dark:bg-blue-900/20 rounded-lg p-2 mt-1">
                            {card.allMeanings.split(/[；;]/).filter(Boolean).map((m, i) => (
                              <p key={i} className="text-xs text-gray-700 dark:text-gray-300 py-0.5">{m.trim()}</p>
                            ))}
                          </div>
                        </div>
                      )}
                      {card.etymology && (
                        <div>
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">🧩 词根记忆</span>
                          <div className="bg-amber-50/60 dark:bg-amber-900/20 rounded-lg p-2 mt-1">
                            <p className="text-xs text-gray-700 dark:text-gray-300">{card.etymology}</p>
                          </div>
                        </div>
                      )}
                      {card.derivatives && (
                        <div>
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">🔄 词形变化</span>
                          <div className="bg-green-50/60 dark:bg-green-900/20 rounded-lg p-2 mt-1">
                            <p className="text-xs text-gray-700 dark:text-gray-300">{card.derivatives}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {/* 操作按钮 */}
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => toggleLearnedWord(card.word)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    learnedWords.has(card.word)
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {learnedWords.has(card.word) ? '✅ 已记住' : '⭐ 标记已记住'}
                </button>
                <button
                  onClick={() => {
                    const newFavorites = { ...favorites }
                    if (!newFavorites[artworkTitle]) newFavorites[artworkTitle] = []
                    const existingIdx = newFavorites[artworkTitle].findIndex(w => w.word === card.word)
                    if (existingIdx >= 0) {
                      newFavorites[artworkTitle].splice(existingIdx, 1)
                    } else {
                      newFavorites[artworkTitle].push({
                        index: card.index,
                        word: card.word,
                        phonetic: card.phonetic,
                        pos: card.pos,
                        meaning: card.meaning,
                        sentence: card.storyContext,
                        allMeanings: card.allMeanings,
                        etymology: card.etymology,
                        derivatives: card.derivatives
                      })
                    }
                    setFavorites(newFavorites)
                    saveFavorites(newFavorites)
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isFavorite
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {isFavorite ? '⭐ 已收藏' : '☆ 收藏'}
                </button>
              </div>
            </div>
          )})}
        </div>
        
        {/* 翻页控制 */}
        <div className="flex items-center justify-center gap-4 mt-6 pb-4">
          <button
            onClick={() => {
              if (currentStoryDay > 1) {
                const newDay = currentStoryDay - 1
                setCurrentStoryDay(newDay)
                generateStoryWords(newDay)
              }
            }}
            disabled={currentStoryDay <= 1}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← 上一天
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">第 {currentStoryDay} 天</span>
          <button
            onClick={() => {
              const newDay = currentStoryDay + 1
              setCurrentStoryDay(newDay)
              generateStoryWords(newDay)
            }}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
          >
            下一天 →
          </button>
        </div>
      </div>
    )

    // 判断步骤1是否完成
    const isStep1Done = wordSource === 'bank' ? !!selectedWordbankForStory
      : wordSource === 'random' ? true
      : wordSource === 'manual' ? customWords.trim().length > 0
      : wordSource === 'photo' ? false // OCR暂未实现
      : false

    // 获取步骤1的描述文字
    const getStep1Label = () => {
      switch (wordSource) {
        case 'bank':
          return selectedWordbankForStory
            ? wordbankCategories.flatMap(c => c.wordbanks).find(b => b.id === selectedWordbankForStory)?.name || '已选择'
            : '选择单词库'
        case 'random':
          return '系统随机选词'
        case 'manual':
          return customWords.trim() ? `已输入 ${customWords.split(/[,，\n\s]+/).filter(w => w.trim()).length} 个单词` : '手动输入单词'
        case 'photo':
          return '拍照识别单词'
        default:
          return '选择单词来源'
      }
    }

    const getStep1SubLabel = () => {
      switch (wordSource) {
        case 'bank':
          return selectedWordbankForStory
            ? `${wordbankCategories.flatMap(c => c.wordbanks).find(b => b.id === selectedWordbankForStory)?.count || 0} 个单词`
            : '四级、六级、雅思、托福...'
        case 'random':
          return '从所有词库中随机挑选'
        case 'manual':
          return '用逗号或换行分隔多个单词'
        case 'photo':
          return '上传图片自动识别'
        default:
          return ''
      }
    }

    return (
      <div className="animate-fadeIn h-full flex flex-col bg-gradient-to-b from-pink-50 via-purple-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        {/* 顶部标题栏 */}
        <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">WordStory</h1>
              <p className="text-xs text-white/80">把单词串进你喜欢的故事里</p>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        {/* 主要内容区域 */}
        <div className="flex-1 overflow-hidden">
          {storyWords.length === 0 && !storyLoading ? (
            // 选择引导界面
            <div className="h-full overflow-y-auto px-6 py-6 pb-24">
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">📖💕📚</div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">剧情背单词</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                  选择单词来源，输入你喜欢的作品名，我们把单词串进故事里！
                </p>
              </div>
              
              <div className="w-full max-w-sm mx-auto space-y-4">
                {/* 步骤1：选择单词来源 */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">1️⃣</span>
                    <span className="font-medium text-gray-900 dark:text-white">选择单词来源</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setWordSource('bank')}
                      className={`p-3 rounded-xl text-left transition-all text-sm ${
                        wordSource === 'bank'
                          ? 'bg-indigo-100 dark:bg-indigo-900/40 border-2 border-indigo-500'
                          : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="text-lg mb-1">📚</div>
                      <div className="font-medium text-gray-900 dark:text-white">从词库选择</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">四级、六级、雅思...</div>
                    </button>
                    <button
                      onClick={() => setWordSource('random')}
                      className={`p-3 rounded-xl text-left transition-all text-sm ${
                        wordSource === 'random'
                          ? 'bg-indigo-100 dark:bg-indigo-900/40 border-2 border-indigo-500'
                          : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="text-lg mb-1">🎲</div>
                      <div className="font-medium text-gray-900 dark:text-white">系统随机</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">随机从所有词库选词</div>
                    </button>
                    <button
                      onClick={() => setWordSource('manual')}
                      className={`p-3 rounded-xl text-left transition-all text-sm ${
                        wordSource === 'manual'
                          ? 'bg-indigo-100 dark:bg-indigo-900/40 border-2 border-indigo-500'
                          : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="text-lg mb-1">✏️</div>
                      <div className="font-medium text-gray-900 dark:text-white">手动输入</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">输入你想背的单词</div>
                    </button>
                    <button
                      onClick={() => {
                        setWordSource('photo')
                        setShowPhotoUpload(true)
                      }}
                      className={`p-3 rounded-xl text-left transition-all text-sm ${
                        wordSource === 'photo'
                          ? 'bg-indigo-100 dark:bg-indigo-900/40 border-2 border-indigo-500'
                          : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="text-lg mb-1">📷</div>
                      <div className="font-medium text-gray-900 dark:text-white">拍照识别</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">拍照/上传图片识别</div>
                    </button>
                  </div>

                  {/* 单词数量选择 - 仅词库选择和系统随机模式显示 */}
                  {(wordSource === 'bank' || wordSource === 'random') && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">📝 生成单词数量</span>
                    </div>
                    <div className="flex gap-2">
                      {[10, 20, 30].map(num => (
                        <button
                          key={num}
                          onClick={() => setWordsPerDay(num)}
                          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                            wordsPerDay === num
                              ? 'bg-indigo-500 text-white shadow-md'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {num} 个
                        </button>
                      ))}
                    </div>
                  </div>
                  )}

                  {/* 根据选择的来源显示额外操作 */}
                  {wordSource === 'bank' && (
                    <button
                      onClick={() => setShowWordbankSelector(true)}
                      className={`w-full mt-3 p-3 rounded-xl text-left transition-all text-sm ${
                        selectedWordbankForStory
                          ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500'
                          : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-indigo-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{selectedWordbankForStory ? '✅' : '👉'}</span>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {selectedWordbankForStory
                              ? wordbankCategories.flatMap(c => c.wordbanks).find(b => b.id === selectedWordbankForStory)?.name || '已选择'
                              : '点击选择词库'
                            }
                          </div>
                          {selectedWordbankForStory && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {wordbankCategories.flatMap(c => c.wordbanks).find(b => b.id === selectedWordbankForStory)?.count || 0} 个单词
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  )}

                  {wordSource === 'manual' && (
                    <textarea
                      value={customWords}
                      onChange={e => setCustomWords(e.target.value)}
                      placeholder="输入你想背的单词，用逗号或换行分隔&#10;例如：abandon, absolute, abstract..."
                      className="w-full mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-sm resize-none focus:border-indigo-400 focus:outline-none transition-colors"
                      rows={3}
                    />
                  )}
                </div>
                
                {/* 步骤2：输入作品信息 */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">2️⃣</span>
                    <span className="font-medium text-gray-900 dark:text-white">输入作品信息</span>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={artworkTitle}
                      onChange={e => setArtworkTitle(e.target.value)}
                      placeholder="例如：陷入我们的热恋、哈利波特、甄嬛传..."
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:border-indigo-400 focus:outline-none transition-colors"
                    />
                    <input
                      type="text"
                      value={artworkCharacters}
                      onChange={e => setArtworkCharacters(e.target.value)}
                      placeholder="例如：陈路周、徐栀（不填则随机生成）"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:border-indigo-400 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
                
                {/* 开始按钮 */}
                {isStep1Done && artworkTitle.trim() && (
                  <button
                    onClick={() => {
                      setCurrentStoryDay(1)
                      generateStoryWords(1)
                    }}
                    className="w-full py-4 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all animate-pulse"
                  >
                    🎬 开始剧情背单词！
                  </button>
                )}
              </div>
            </div>
          ) : storyLoading ? (
            // 加载中
            <div className="h-full flex flex-col items-center justify-center">
              <div className="w-16 h-16 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-400">正在生成剧情...</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">把单词串进《{artworkTitle}》的故事里</p>
            </div>
          ) : storyWords.length > 0 ? (
            // 剧情单词卡片
            renderStoryWordCards()
          ) : (
            // 无数据
            <div className="h-full flex flex-col items-center justify-center">
              <p className="text-gray-500 dark:text-gray-400">点击下方按钮开始学习</p>
              <button
                onClick={() => generateStoryWords(1)}
                className="mt-4 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl font-medium"
              >
                开始学习
              </button>
            </div>
          )}
        </div>

        {/* 弹窗 */}
        {showWordbankSelector && renderWordbankSelector()}
        {showPhotoUpload && renderPhotoUpload()}
      </div>
    )
  }

  // ==================== 渲染：词库页 ====================
  const renderWordbank = () => (
    <div className="animate-fadeIn">
      {!browseMode ? (
        <div className="space-y-6">
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">词库</h2>
            <p className="text-gray-500 dark:text-gray-400">选择词库浏览单词，或探索词根专题</p>
          </div>

          {/* 功能10: 词根专题入口 */}
          <button
            onClick={() => setExpandedRoot(expandedRoot === '__roots__' ? null : '__roots__')}
            className="w-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-5 shadow-md text-left text-white hover:shadow-lg transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🧩</span>
                <div>
                  <h3 className="font-bold text-lg">词根专题</h3>
                  <p className="text-sm text-white/80">通过词根词缀系统学习单词</p>
                </div>
              </div>
              <span className="text-xl">{expandedRoot === '__roots__' ? '▲' : '▼'}</span>
            </div>
          </button>

          {/* 词根网格 */}
          {expandedRoot === '__roots__' && (
            <div className="animate-fadeIn">
              {rootsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {roots.map(root => (
                    <div key={root.root} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                      <button
                        onClick={() => setExpandedRoot(expandedRoot === root.root ? null : root.root)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{root.root}</span>
                          <span className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">{root.count}词</span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{root.meaning}</p>
                      </button>
                      {expandedRoot === root.root && root.words && (
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2 animate-fadeIn">
                          {root.words.map((w, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="font-medium text-gray-900 dark:text-white">{w.word}</span>
                              <span className="text-gray-500 dark:text-gray-400 text-xs">{w.meaning}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 词库列表（带学习进度） */}
          {wordbankCategories.map(category => (
            <div key={category.category}>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 px-1">{category.category}</h4>
              <div className="space-y-2">
                {category.wordbanks.map(bank => {
                  const bankLearned = [...learnedWords].filter(w => {
                    // 简单估算：实际应通过API获取精确数据
                    return false
                  }).length
                  return (
                    <button
                      key={bank.id}
                      onClick={() => handleWordbankSelect(bank.id)}
                      className="w-full bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm hover:shadow-md border border-gray-100 dark:border-gray-700 transition-all text-left flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {bank.id === 'ielts' && '🎓'}
                          {bank.id === 'cet4' && '📘'}
                          {bank.id === 'cet6' && '📗'}
                          {bank.id === 'gre' && '📕'}
                          {bank.id === 'toefl' && '📙'}
                          {bank.id === 'primary' && '🏫'}
                          {bank.id === 'middle' && '📚'}
                          {bank.id === 'high' && '🎒'}
                          {bank.id === 'pte' && '📝'}
                          {bank.id === 'postgraduate' && '🎓'}
                          {bank.id === 'bec' && '💼'}
                          {bank.id === 'sat' && '📋'}
                        </span>
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{bank.name}</h4>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{bank.count} 词</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-400 dark:text-gray-500">已学 0/{bank.count}</div>
                        <div className="w-20 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mt-1">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: '0%' }} />
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* 拍照/上传识别 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-dashed border-gray-300 dark:border-gray-600">
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 font-medium mb-4">📸 拍照或上传识别单词</p>
              <div className="flex justify-center gap-4">
                <button onClick={startCamera} className="px-6 py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors flex items-center gap-2">📷 拍照识别</button>
                <label className="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer flex items-center gap-2">
                  📁 上传图片
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 浏览模式 */
        <div className="animate-fadeIn">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white mb-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  {wordbankCategories.flatMap(c => c.wordbanks).find(b => b.id === selectedBank)?.name}
                </h2>
                <p className="text-indigo-100 text-sm mt-1">共 {browseWords.length} 个单词 · 按字母浏览</p>
              </div>
              <button onClick={handleBackToWordbanks} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors backdrop-blur-sm">← 返回</button>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
              {(browseLetters || []).map(letter => {
                const count = getWordsByLetter(letter).length
                const isActive = browseLetter === letter
                return (
                  <button key={letter} onClick={() => setBrowseLetter(letter)}
                    className={`w-10 h-10 rounded-lg font-bold text-sm transition-all ${isActive ? 'bg-indigo-500 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-gray-700 shadow-sm border border-gray-100 dark:border-gray-700'}`}>
                    {letter}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{browseLetter} 开头的单词</h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">{getWordsByLetter(browseLetter).length} 个</span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
                <p className="mt-4 text-gray-500 dark:text-gray-400">加载中...</p>
              </div>
            ) : getWordsByLetter(browseLetter).length === 0 ? (
              <div className="text-center py-16 text-gray-400 dark:text-gray-500">暂无 {browseLetter} 开头的单词</div>
            ) : (
              getWordsByLetter(browseLetter).map((word, idx) => {
                const isExpanded = browseExpandedWords.has(word.word)
                const hasDetail = word.allMeanings || word.etymology || word.derivatives
                const isLearned = learnedWords.has(word.word)
                return (
                  <div key={idx} className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all border ${isLearned ? 'border-green-200 dark:border-green-800 opacity-75' : 'border-gray-100 dark:border-gray-700'}`}>
                    <div className="p-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* 功能4: 已学复选框 */}
                        <button
                          onClick={() => handleMarkLearned(word.word)}
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isLearned ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 dark:border-gray-600 hover:border-green-400'}`}
                        >
                          {isLearned && <span className="text-xs">✓</span>}
                        </button>
                        <span className={`text-lg font-bold ${isLearned ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>{word.word}</span>
                        <span className="text-sm text-gray-400 dark:text-gray-500 font-mono">{word.phonetic}</span>
                        <span className="text-xs px-2 py-0.5 bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 rounded-full">{word.pos}</span>
                        <span className={`text-sm ${isLearned ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-300'}`}>{word.meaning}</span>
                        <div className="flex gap-1 ml-auto">
                          <button onClick={() => playAudio(word.word, 'us')} className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-xs hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">🔊 美</button>
                          <button onClick={() => playAudio(word.word, 'uk')} className="px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded text-xs hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors">🔊 英</button>
                          {hasDetail && (
                            <button onClick={() => toggleBrowseWordExpand(word.word)} className="ml-1 px-2 py-1 text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors">
                              {isExpanded ? '▲' : '▼'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {isExpanded && hasDetail && (
                      <div className="px-4 pb-4 pt-0">
                        <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-3">
                          {word.allMeanings && (
                            <div>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">📖 全部词义</span>
                              <div className="bg-blue-50/60 dark:bg-blue-900/20 rounded-lg p-3 mt-1">
                                {word.allMeanings.split(/[；;]/).filter(Boolean).map((m, i) => (
                                  <p key={i} className="text-sm text-gray-700 dark:text-gray-300 py-0.5">{m.trim()}</p>
                                ))}
                              </div>
                            </div>
                          )}
                          {word.derivatives && (
                            <div>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🔄 词形变化</span>
                              <div className="bg-green-50/60 dark:bg-green-900/20 rounded-lg p-3 mt-1">
                                <p className="text-sm text-gray-700 dark:text-gray-300">{word.derivatives}</p>
                              </div>
                            </div>
                          )}
                          {word.etymology && (
                            <div>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🧩 词根记忆</span>
                              <div className="bg-amber-50/60 dark:bg-amber-900/20 rounded-lg p-3 mt-1">
                                <p className="text-sm text-gray-700 dark:text-gray-300">{word.etymology}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* 摄像头界面 */}
      {showCamera && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 max-w-lg w-full">
            <div className="relative">
              <video ref={videoRef} autoPlay playsInline className="w-full rounded-xl" />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={capturePhoto} className="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-medium">📸 拍照</button>
              <button onClick={stopCamera} className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium">取消</button>
            </div>
          </div>
        </div>
      )}

      {/* 识别结果 */}
      {capturedImage && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex gap-4">
            <img src={capturedImage} alt="识别图片" className="w-32 h-32 object-cover rounded-xl" />
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">识别结果</h4>
              {loading ? (
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  正在识别...
                </div>
              ) : (
                <textarea value={recognizedWords} onChange={(e) => setRecognizedWords(e.target.value)}
                  className="w-full h-32 p-3 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-mono resize-none bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
                  placeholder="识别到的单词会显示在这里..." />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ==================== 渲染：测验页 ====================
  const renderQuiz = () => (
    <div className="animate-fadeIn">
      {quizState === 'select' && (
        <div className="space-y-6">
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">单词测验</h2>
            <p className="text-gray-500 dark:text-gray-400">选择词库开始测验，每次10道题</p>
          </div>
          <div className="space-y-3">
            {wordbankCategories.flatMap(c => c.wordbanks).map(bank => (
              <button
                key={bank.id}
                onClick={() => startQuiz(bank.id)}
                className="w-full bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm hover:shadow-md border border-gray-100 dark:border-gray-700 transition-all text-left flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {bank.id === 'ielts' && '🎓'}{bank.id === 'cet4' && '📘'}{bank.id === 'cet6' && '📗'}
                    {bank.id === 'gre' && '📕'}{bank.id === 'toefl' && '📙'}{bank.id === 'primary' && '🏫'}
                    {bank.id === 'middle' && '📚'}{bank.id === 'high' && '🎒'}{bank.id === 'pte' && '📝'}
                    {bank.id === 'postgraduate' && '🎓'}{bank.id === 'bec' && '💼'}{bank.id === 'sat' && '📋'}
                  </span>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{bank.name}</h4>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{bank.count} 词 · 10道题</p>
                  </div>
                </div>
                <span className="text-indigo-500 dark:text-indigo-400">开始 →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {quizState === 'playing' && quizQuestions.length > 0 && (
        <div className="space-y-6">
          {/* 进度条 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">第 {quizCurrentIdx + 1}/{quizQuestions.length} 题</span>
              <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">得分: {quizScore}</span>
            </div>
            <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full">
              <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${((quizCurrentIdx + 1) / quizQuestions.length) * 100}%` }} />
            </div>
          </div>

          {/* 题目 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">{quizQuestions[quizCurrentIdx].question}</h3>
            <div className="space-y-3">
              {quizQuestions[quizCurrentIdx].options.map((option, idx) => {
                let btnClass = 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white hover:border-indigo-300 dark:hover:border-indigo-500'
                if (quizSelected !== null) {
                  if (idx === quizQuestions[quizCurrentIdx].answer) {
                    btnClass = 'bg-green-50 dark:bg-green-900/30 border-green-400 text-green-700 dark:text-green-400'
                  } else if (idx === quizSelected) {
                    btnClass = 'bg-red-50 dark:bg-red-900/30 border-red-400 text-red-700 dark:text-red-400'
                  } else {
                    btnClass = 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500'
                  }
                }
                return (
                  <button
                    key={idx}
                    onClick={() => handleQuizAnswer(idx)}
                    disabled={quizSelected !== null}
                    className={`w-full p-4 rounded-xl border-2 text-left font-medium transition-all ${btnClass} ${quizSelected === null ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="mr-3 text-gray-400">{String.fromCharCode(65 + idx)}.</span>
                    {option}
                    {quizSelected !== null && idx === quizQuestions[quizCurrentIdx].answer && <span className="float-right">✓</span>}
                    {quizSelected === idx && idx !== quizQuestions[quizCurrentIdx].answer && <span className="float-right">✗</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {quizState === 'result' && (
        <div className="animate-fadeIn space-y-6">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-8 text-white text-center shadow-xl">
            <div className="text-6xl mb-4">{quizScore === quizQuestions.length ? '🎉' : quizScore >= 7 ? '👏' : quizScore >= 5 ? '💪' : '📚'}</div>
            <h2 className="text-2xl font-bold mb-2">测验完成！</h2>
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div>
                <div className="text-3xl font-bold">{quizScore}/{quizQuestions.length}</div>
                <div className="text-sm text-white/70">正确数</div>
              </div>
              <div>
                <div className="text-3xl font-bold">{Math.round((quizScore / quizQuestions.length) * 100)}%</div>
                <div className="text-sm text-white/70">正确率</div>
              </div>
              <div>
                <div className="text-3xl font-bold">{Math.round((quizEndTime - quizStartTime) / 1000)}s</div>
                <div className="text-sm text-white/70">用时</div>
              </div>
            </div>
          </div>

          {/* 功能11: 分享按钮 */}
          <button
            onClick={handleShare}
            className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
          >
            📤 分享成绩
          </button>

          <button
            onClick={() => setQuizState('select')}
            className="w-full py-3 border-2 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl font-medium hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
          >
            再来一次
          </button>
        </div>
      )}
    </div>
  )

  // ==================== 渲染：我的页面（仪表盘） ====================
  const renderProfile = () => {
    const maxWeekCount = stats?.weekData?.length ? Math.max(...stats.weekData.map(d => d.count), 1) : 1

    return (
      <div className="animate-fadeIn space-y-6">
        {/* 用户卡片 */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl">📚</div>
            <div>
              <h2 className="text-xl font-bold">我的学习</h2>
              <p className="text-white/70 text-sm">坚持每天学习，积少成多</p>
            </div>
          </div>
        </div>

        {/* 统计数据 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats?.totalLearned ?? learnedWords.size}</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">累计学习</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow-sm border border-gray-100 dark:border-gray-700">
            <div className={`text-2xl font-bold ${dailyStreak >= 7 ? 'text-amber-500' : 'text-orange-500'}`}>
              <span className={dailyStreak >= 7 ? 'animate-flame' : ''}>{dailyStreak >= 7 ? '🔥' : '🔥'}</span> {stats?.dailyStreak ?? dailyStreak}
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">连续打卡</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats?.todayWordCount ?? todayWordCount}</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">今日已学</div>
          </div>
        </div>

        {/* 本周热力图 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">本周学习</h3>
          <div className="grid grid-cols-7 gap-2">
            {(stats?.weekData || []).map((day, i) => (
              <div key={i} className="text-center">
                <div
                  className="w-full aspect-square rounded-lg mx-auto transition-all"
                  style={{
                    backgroundColor: day.count > 0
                      ? `rgba(99, 102, 241, ${Math.min(day.count / maxWeekCount, 1) * 0.8 + 0.2})`
                      : 'rgb(229 231 235)',
                  }}
                  title={`${day.day}: ${day.count}词`}
                />
                <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 block">{day.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 成就徽章 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">成就徽章</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {(stats?.achievements || []).map(ach => (
              <div
                key={ach.id}
                className={`rounded-xl p-3 text-center transition-all ${ach.unlocked ? 'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800 animate-glow' : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 opacity-50'}`}
                title={ach.description}
              >
                <div className={`text-3xl mb-1 ${ach.unlocked ? '' : 'grayscale'}`}>{ach.icon}</div>
                <div className={`text-xs font-medium ${ach.unlocked ? 'text-amber-700 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>{ach.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 历史记录入口 */}
        <button
          onClick={() => setShowHistory(true)}
          className="w-full bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-left flex items-center justify-between hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">📜</span>
            <span className="font-medium text-gray-900 dark:text-white">生成历史</span>
          </div>
          <span className="text-gray-400 dark:text-gray-500">→</span>
        </button>

        {/* 收藏入口 */}
        <button
          onClick={() => setShowFavorites(true)}
          className="w-full bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-left flex items-center justify-between hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">⭐</span>
            <span className="font-medium text-gray-900 dark:text-white">我的收藏</span>
          </div>
          <span className="text-gray-400 dark:text-gray-500">→</span>
        </button>
      </div>
    )
  }

  // ==================== 渲染：设置页 ====================
  const renderSettings = () => (
    <div className="animate-fadeIn space-y-6">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">设置</h2>
      </div>

      {/* 深色模式 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">{darkMode ? '🌙' : '☀️'}</span>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">深色模式</h4>
              <p className="text-xs text-gray-400 dark:text-gray-500">保护眼睛，夜间学习更舒适</p>
            </div>
          </div>
          <button
            onClick={toggleDarkMode}
            className={`w-12 h-7 rounded-full transition-colors relative ${darkMode ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {/* 学习数据 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">学习数据</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">已学单词数</span>
            <span className="font-medium text-gray-900 dark:text-white">{learnedWords.size}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">连续打卡天数</span>
            <span className="font-medium text-gray-900 dark:text-white">{dailyStreak} 天</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">历史记录数</span>
            <span className="font-medium text-gray-900 dark:text-white">{history.length}</span>
          </div>
        </div>
      </div>

      {/* 清除数据 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">数据管理</h4>
        <button
          onClick={() => {
            if (confirm('确定要清除所有学习数据吗？此操作不可撤销。')) {
              localStorage.removeItem(STORAGE_KEYS.LEARNED_WORDS)
              localStorage.removeItem(STORAGE_KEYS.DAILY_STREAK)
              localStorage.removeItem(STORAGE_KEYS.LAST_STUDY_DATE)
              localStorage.removeItem(STORAGE_KEYS.TODAY_WORD_COUNT)
              localStorage.removeItem(STORAGE_KEYS.TODAY_DATE)
              setLearnedWords(new Set())
              setDailyStreak(0)
              setLastStudyDate('')
              setTodayWordCount(0)
            }
          }}
          className="w-full py-2.5 border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          🗑️ 清除学习数据
        </button>
      </div>

      {/* 关于 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
          <span className="text-white font-bold text-lg">W</span>
        </div>
        <h4 className="font-bold text-gray-900 dark:text-white">WordStory</h4>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">剧情背单词 v2.0</p>
      </div>
    </div>
  )

  // ==================== 主渲染 ====================
  return (
    <div className={`min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 pb-safe ${activeTab === 'home' ? 'h-screen overflow-hidden' : ''}`}>
      {/* 顶部导航 - 首页时隐藏，使用首页自己的顶部栏 */}
      {activeTab !== 'home' && (
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { handleReset(); setActiveTab('home') }}>
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30">
              <span className="text-white font-bold text-sm">W</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">WordStory</h1>
              <p className="text-xs text-gray-400 dark:text-gray-500">剧情背单词</p>
            </div>
          </div>

          {/* 搜索框 */}
          <div className="flex-1 max-w-md mx-4 relative">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => searchQuery.trim() && setShowSearchResults(true)}
                placeholder="搜索单词或释义..."
                className="w-full px-4 py-2 pl-10 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              {searchLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin">⏳</span>}
            </div>
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 max-h-80 overflow-y-auto z-50">
                {searchResults.map((r, index) => (
                  <div key={index} onClick={() => handleSearchResultClick(r)}
                    className="px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer border-b border-gray-50 dark:border-gray-700 last:border-0 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white">{r.word}</span>
                        {r.phonetic && <span className="text-sm text-gray-500 dark:text-gray-400">{r.phonetic}</span>}
                      </div>
                      <span className="text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full">{r.bankName}</span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {r.pos && <span className="text-indigo-500 dark:text-indigo-400 mr-1">{r.pos}</span>}{r.meaning}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {showSearchResults && !searchLoading && searchQuery.trim() && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-4 text-center text-gray-500 dark:text-gray-400 z-50">😕 未找到相关单词</div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* 功能1: 深色模式切换 */}
            <button
              onClick={toggleDarkMode}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={darkMode ? '切换亮色模式' : '切换深色模式'}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            {/* 历史记录 */}
            <button onClick={() => { setShowHistory(true); setShowFavorites(false); setShowSearchResults(false) }}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors">📜</button>
            {/* 收藏 */}
            <button onClick={() => { setShowFavorites(true); setShowHistory(false); setShowSearchResults(false) }}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors">⭐</button>
          </div>
        </div>
      </header>
      )}

      <main className={`${activeTab === 'home' ? 'h-full p-0' : 'max-w-4xl mx-auto px-4 py-6'}`} onClick={() => setShowSearchResults(false)}>
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
            <span className="text-red-500">⚠️</span>
            <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* 历史记录弹窗 */}
        {showHistory && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">📜 生成历史</h3>
                <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
              </div>
              <div className="overflow-y-auto max-h-[60vh]">
                {history.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 dark:text-gray-500">暂无历史记录</div>
                ) : (
                  history.map(item => (
                    <div key={item.id} onClick={() => loadFromHistory(item)}
                      className="p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex items-center justify-between group">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{item.workInfo.title}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{item.wordbank.name} · {item.words.length}个单词 · {formatTime(item.timestamp)}</p>
                      </div>
                      <button onClick={(e) => deleteHistory(item.id, e)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 px-2">🗑️</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 收藏弹窗 */}
        {showFavorites && (
          <FavoritesModal favorites={favorites} onClose={() => setShowFavorites(false)} playAudio={playAudio} />
        )}

        {/* 步骤2：填写作品信息 */}
        {step === 2 && (
          <div className="animate-fadeIn">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">填写你喜欢的作品</h2>
              <p className="text-gray-500 dark:text-gray-400">输入你喜欢的剧、小说、动漫或电影</p>
            </div>
            <button onClick={() => setStep(1)} className="mb-4 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1">← 重新选择词库</button>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm space-y-5 border border-gray-100 dark:border-gray-700">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">作品名称 <span className="text-red-500">*</span></label>
                <input type="text" value={workTitle} onChange={(e) => setWorkTitle(e.target.value)} placeholder="例如：陷入我们的热恋、庆余年、鬼灭之刃..."
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">作品类型</label>
                <div className="flex gap-2 flex-wrap">
                  {['小说', '电视剧', '动漫', '电影'].map(type => (
                    <button key={type} onClick={() => setWorkType(type)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${workType === type ? 'bg-indigo-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>{type}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">主要角色 <span className="text-gray-400 font-normal">（可选）</span></label>
                <input type="text" value={workCharacters} onChange={(e) => setWorkCharacters(e.target.value)} placeholder="例如：陈路周、徐栀..."
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">剧情简介 <span className="text-gray-400 font-normal">（可选）</span></label>
                <textarea value={workPlot} onChange={(e) => setWorkPlot(e.target.value)} placeholder="简单描述一下剧情..."
                  className="w-full h-24 px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400">已选词库：<span className="font-medium text-indigo-600 dark:text-indigo-400">{wordbankCategories.flatMap(c => c.wordbanks).find((b: WordbankInfo) => b.id === selectedBank)?.name}</span></div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-500 dark:text-gray-400">单词数量</label>
                    <select value={wordCount} onChange={(e) => setWordCount(Number(e.target.value))}
                      className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white">
                      {[10, 15, 20, 25, 30].map(n => <option key={n} value={n}>{n}个</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <button onClick={handleGenerate} disabled={!workTitle.trim() || loading}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-indigo-200 dark:hover:shadow-indigo-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                {loading ? <span className="flex items-center justify-center gap-2"><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>AI正在创作中...</span> : '✨ 开始生成'}
              </button>
            </div>
          </div>
        )}

        {/* 步骤3：生成中（含流式进度） */}
        {step === 3 && (
          <div className="flex flex-col items-center justify-center py-16 animate-fadeIn">
            {streamingWords.length > 0 ? (
              /* 功能9: 流式输出显示 */
              <div className="w-full space-y-4">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-full">
                    <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse" />
                    <span className="text-sm text-indigo-600 dark:text-indigo-400">{streamingProgress || '正在生成...'}</span>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{workTitle} × {wordbankCategories.flatMap(c => c.wordbanks).find(b => b.id === selectedBank)?.name}</h3>
                  <div className="space-y-3">
                    {streamingWords.map((item) => (
                      <div key={item.index} className="word-fade-in bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center text-lg text-gray-900 dark:text-gray-100 font-black">{item.index}.</span>
                          <span className="font-bold text-gray-900 dark:text-white">{item.word}</span>
                          <span className="text-sm text-gray-400 dark:text-gray-500 font-mono">{item.phonetic}</span>
                          <span className="text-xs px-2 py-0.5 bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 rounded-full">{item.pos}</span>
                          <span className="text-sm text-gray-600 dark:text-gray-300">{item.meaning}</span>
                        </div>
                        {item.sentence && (
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{highlightWord(item.sentence, item.word)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-indigo-100 dark:border-indigo-900 rounded-full" />
                  <div className="w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
                </div>
                <h3 className="mt-8 text-xl font-bold text-gray-900 dark:text-white">AI正在创作中...</h3>
                <p className="mt-2 text-gray-500 dark:text-gray-400 text-sm">正在将单词融入{workTitle}的剧情</p>
                <p className="mt-1 text-gray-400 dark:text-gray-500 text-xs">通常需要10-30秒</p>
              </>
            )}
          </div>
        )}

        {/* 步骤4：结果展示 */}
        {step === 4 && result && (
          <div className="animate-fadeIn">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white mb-6 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">{result.workInfo.title} × {result.wordbank.name}</h2>
                  <p className="text-indigo-100 text-sm mt-1">共 {result.words.length} 个单词</p>
                </div>
                <div className="flex gap-2">
                  {/* 功能11: 分享按钮 */}
                  <button onClick={handleShare} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors backdrop-blur-sm">📤 分享</button>
                  <button onClick={handleReset} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors backdrop-blur-sm">重新开始</button>
                </div>
              </div>
            </div>

            {selectedWords.size > 0 && (
              <div className="mb-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 flex items-center justify-between">
                <span className="text-sm text-indigo-700 dark:text-indigo-400">已选择 {selectedWords.size} 个单词</span>
                <button onClick={addToFavorites} className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors">⭐ 收藏选中</button>
              </div>
            )}

            <div className="space-y-4">
              {result.words.map((item) => {
                const wordKey = `${result.id}_${item.index}`
                const isSelected = selectedWords.has(wordKey)
                const isExpanded = expandedWords.has(wordKey)
                const hasDetail = item.allMeanings || item.etymology
                const isLearned = learnedWords.has(item.word)
                return (
                  <div key={item.index} className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all border ${isSelected ? 'ring-2 ring-indigo-300 dark:ring-indigo-600' : ''} ${isLearned ? 'border-green-200 dark:border-green-800' : 'border-gray-100 dark:border-gray-700'}`}>
                    <div className="flex items-start gap-4 p-5">
                      <button
                        onClick={() => toggleWordSelection(wordKey)}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 transition-colors ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400'}`}
                      >
                        {isSelected && <span className="text-white text-xs">✓</span>}
                      </button>
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-gray-900 dark:text-gray-100 font-black text-lg">{item.index}.</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-lg font-bold ${isLearned ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>{item.word}</span>
                          <span className="text-sm text-gray-400 dark:text-gray-500 font-mono">{item.phonetic}</span>
                          <span className="text-xs px-2 py-0.5 bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 rounded-full">{item.pos}</span>
                          <span className={`text-sm ${isLearned ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-300'}`}>{item.meaning}</span>
                          <div className="flex gap-1 ml-2">
                            <button onClick={() => playAudio(item.word, 'us')} className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-xs hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">🔊 美</button>
                            <button onClick={() => playAudio(item.word, 'uk')} className="px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded text-xs hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors">🔊 英</button>
                          </div>
                          {/* 功能4: 已学标记 */}
                          <button
                            onClick={() => handleMarkLearned(item.word)}
                            className={`ml-auto px-2 py-1 rounded text-xs transition-colors ${isLearned ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                          >
                            {isLearned ? '✓ 已学' : '○ 标记已学'}
                          </button>
                          {hasDetail && (
                            <button onClick={() => toggleWordExpand(wordKey)}
                              className="px-2 py-1 text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors flex-shrink-0">
                              {isExpanded ? '▲' : '▼'}
                            </button>
                          )}
                        </div>
                        <p className="mt-2 text-gray-700 dark:text-gray-300 leading-relaxed">{highlightWord(item.sentence, item.word)}</p>
                      </div>
                    </div>
                    {isExpanded && hasDetail && (
                      <div className="px-5 pb-5 pt-0 ml-[72px]">
                        <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-3">
                          {item.allMeanings && (
                            <div>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">📖 全部词义</span>
                              <div className="bg-blue-50/60 dark:bg-blue-900/20 rounded-lg p-3 mt-1">
                                {item.allMeanings.split(/[；;]/).filter(Boolean).map((m, i) => (
                                  <p key={i} className="text-sm text-gray-700 dark:text-gray-300 py-0.5">{m.trim()}</p>
                                ))}
                              </div>
                            </div>
                          )}
                          {item.derivatives && (
                            <div>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🔄 词形变化</span>
                              <div className="bg-green-50/60 dark:bg-green-900/20 rounded-lg p-3 mt-1">
                                <p className="text-sm text-gray-700 dark:text-gray-300">{item.derivatives}</p>
                              </div>
                            </div>
                          )}
                          {item.etymology && (
                            <div>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🧩 词根记忆</span>
                              <div className="bg-amber-50/60 dark:bg-amber-900/20 rounded-lg p-3 mt-1">
                                <p className="text-sm text-gray-700 dark:text-gray-300">{item.etymology}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-8 flex justify-center gap-4">
              <button onClick={handleReset} className="px-6 py-2.5 border-2 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl font-medium hover:border-gray-300 dark:hover:border-gray-600 transition-colors">← 重新选择</button>
              <button onClick={() => navigator.clipboard.writeText(formatForCopy(result.words))} className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors">📋 复制全部</button>
            </div>
          </div>
        )}

        {/* ==================== Tab 页面路由 ==================== */}
        {step !== 2 && step !== 3 && step !== 4 && (
          <>
            {activeTab === 'home' && renderHome()}
            {activeTab === 'wordbank' && renderWordbank()}
            {activeTab === 'quiz' && renderQuiz()}
            {activeTab === 'profile' && renderProfile()}
            {activeTab === 'settings' && renderSettings()}
          </>
        )}
      </main>

      {/* 功能2: 底部导航栏 */}
      {step !== 2 && step !== 3 && step !== 4 && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 z-50">
          <div className="max-w-4xl mx-auto flex items-center justify-around px-2 py-2">
            {([
              { key: 'home' as TabType, icon: '🏠', label: '首页' },
              { key: 'wordbank' as TabType, icon: '📚', label: '词库' },
              { key: 'quiz' as TabType, icon: '🧪', label: '测验' },
              { key: 'profile' as TabType, icon: '📊', label: '我的' },
              { key: 'settings' as TabType, icon: '⚙️', label: '设置' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${activeTab === tab.key ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
              >
                <span className="text-xl">{tab.icon}</span>
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      <footer className="text-center py-6 text-xs text-gray-400 dark:text-gray-600 pb-20">WordStory - 让背单词变得有趣</footer>
    </div>
  )
}

export default App
