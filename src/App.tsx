import { useState, useEffect, useRef } from 'react'

// 自动检测 API 地址
// 1. 优先使用环境变量
// 2. 其次检查是否有 api 查询参数
// 3. 本地开发使用 localhost:3001
// 4. 生产环境使用相对路径 /api (通过 Vercel 代理)
const getApiUrl = () => {
  const urlParams = new URLSearchParams(window.location.search)
  const apiParam = urlParams.get('api')
  if (apiParam) return apiParam
  
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  
  if (window.location.hostname === 'localhost') return 'http://localhost:3001'
  
  // Vercel 部署时使用相对路径，vercel.json 会代理到后端
  return ''
}

const API = getApiUrl()

// ==================== 类型定义 ====================
interface WordbankInfo {
  id: string
  name: string
  count: number
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

// ==================== 本地存储工具 ====================
const STORAGE_KEYS = {
  HISTORY: 'wordstory_history',
  FAVORITES: 'wordstory_favorites'
}

const saveHistory = (history: GenerateResult[]) => {
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history))
}

const loadHistory = (): GenerateResult[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.HISTORY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

const saveFavorites = (favorites: Favorites) => {
  localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites))
}

const loadFavorites = (): Favorites => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.FAVORITES)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

// ==================== 主应用 ====================
function App() {
  const [step, setStep] = useState(1)
  const [wordbanks, setWordbanks] = useState<WordbankInfo[]>([])
  const [selectedBank, setSelectedBank] = useState<string>('')
  const [wordCount, setWordCount] = useState(20)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // 历史记录和收藏
  const [history, setHistory] = useState<GenerateResult[]>([])
  const [favorites, setFavorites] = useState<Favorites>({})
  const [showHistory, setShowHistory] = useState(false)
  const [showFavorites, setShowFavorites] = useState(false)
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set())
  const [expandedWords, setExpandedWords] = useState<Set<string>>(new Set())
  
  // 作品信息
  const [workTitle, setWorkTitle] = useState('')
  const [workType, setWorkType] = useState('小说')
  const [workCharacters, setWorkCharacters] = useState('')
  const [workPlot, setWorkPlot] = useState('')
  
  // 拍照识别
  const [showCamera, setShowCamera] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [recognizedWords, setRecognizedWords] = useState<string>('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    fetch(API ? `${API}/api/wordbanks` : '/api/wordbanks').then(r => r.json()).then(d => setWordbanks(d.data || []))
    setHistory(loadHistory())
    setFavorites(loadFavorites())
  }, [])

  // 启动摄像头
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setShowCamera(true)
    } catch (err) {
      setError('无法访问摄像头，请确保已授予权限')
    }
  }

  // 停止摄像头
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    setShowCamera(false)
  }

  // 拍照
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

  // 模拟OCR识别
  const recognizeWords = async (imageData: string) => {
    setLoading(true)
    await new Promise(r => setTimeout(r, 1500))
    const mockWords = `abandon /əˈbændən/ v. 放弃
ability /əˈbɪləti/ n. 能力
absolute /ˈæbsəluːt/ adj. 绝对的
abstract /ˈæbstrækt/ adj. 抽象的
academic /ˌækəˈdemɪk/ adj. 学术的`
    setRecognizedWords(mockWords)
    setLoading(false)
  }

  // 上传图片识别
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

  const handleGenerate = async () => {
    if (!selectedBank || !workTitle.trim()) {
      setError('请填写作品名称')
      return
    }
    setLoading(true)
    setError('')
    setStep(3)
    try {
      const res = await fetch(API ? `${API}/api/generate` : '/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wordbankId: selectedBank,
          count: wordCount,
          workInfo: {
            title: workTitle,
            type: workType,
            characters: workCharacters,
            plot: workPlot
          }
        })
      })
      const data = await res.json()
      if (data.success) {
        const newResult: GenerateResult = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          ...data.data
        }
        setResult(newResult)
        const newHistory = [newResult, ...history].slice(0, 50)
        setHistory(newHistory)
        saveHistory(newHistory)
        setStep(4)
      } else {
        setError(data.message || '生成失败')
        setStep(2)
      }
    } catch (e: unknown) {
      setError('网络错误，请检查后端服务是否启动')
      setStep(2)
    } finally {
      setLoading(false)
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
  }

  // 播放发音
  const playAudio = (word: string, accent: 'us' | 'uk') => {
    const audio = new Audio(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${accent === 'us' ? '2' : '1'}`)
    audio.play().catch(() => {
      const fallbackAudio = new Audio(`https://ssl.gstatic.com/dictionary/static/sounds/oxford/${word.toLowerCase()}--_${accent}_1.mp3`)
      fallbackAudio.play().catch(() => {
        alert('发音加载失败，请检查网络')
      })
    })
  }

  // 选择/取消选择单词
  const toggleWordSelection = (wordKey: string) => {
    const newSelected = new Set(selectedWords)
    if (newSelected.has(wordKey)) {
      newSelected.delete(wordKey)
    } else {
      newSelected.add(wordKey)
    }
    setSelectedWords(newSelected)
  }

  // 展开/收起单词详情
  const toggleWordExpand = (wordKey: string) => {
    const newExpanded = new Set(expandedWords)
    if (newExpanded.has(wordKey)) {
      newExpanded.delete(wordKey)
    } else {
      newExpanded.add(wordKey)
    }
    setExpandedWords(newExpanded)
  }

  // 收藏选中的单词
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

  // 从历史记录加载
  const loadFromHistory = (item: GenerateResult) => {
    setResult(item)
    setStep(4)
    setShowHistory(false)
  }

  // 删除历史记录
  const deleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newHistory = history.filter(h => h.id !== id)
    setHistory(newHistory)
    saveHistory(newHistory)
  }

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* 顶部导航 */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={handleReset}>
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <span className="text-white font-bold text-sm">W</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">WordStory</h1>
              <p className="text-xs text-gray-400">剧情背单词</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* 历史记录按钮 */}
            <button
              onClick={() => { setShowHistory(true); setShowFavorites(false) }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              📜 历史
            </button>
            {/* 收藏按钮 */}
            <button
              onClick={() => { setShowFavorites(true); setShowHistory(false) }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              ⭐ 收藏
            </button>
            {/* 步骤指示器 */}
            <div className="flex items-center gap-2 text-sm ml-2">
              {['选词库', '填作品', '看结果'].map((label, i) => {
                const stepNum = i + 1
                const isActive = step === stepNum || (step === 3 && stepNum === 2)
                const isDone = step > stepNum && step !== 3
                return (
                  <div key={i} className="flex items-center gap-1.5">
                    {i > 0 && <div className={`w-6 h-px ${isDone ? 'bg-indigo-400' : 'bg-gray-200'}`} />}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all
                      ${isDone ? 'bg-indigo-500 text-white' : isActive ? 'bg-indigo-100 text-indigo-600 ring-2 ring-indigo-300' : 'bg-gray-100 text-gray-400'}`}>
                      {isDone ? '✓' : stepNum}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <span className="text-red-500">⚠️</span>
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* 历史记录弹窗 */}
        {showHistory && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-lg">📜 生成历史</h3>
                <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="overflow-y-auto max-h-[60vh]">
                {history.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">暂无历史记录</div>
                ) : (
                  history.map(item => (
                    <div
                      key={item.id}
                      onClick={() => loadFromHistory(item)}
                      className="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer flex items-center justify-between group"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{item.workInfo.title}</p>
                        <p className="text-sm text-gray-500">{item.wordbank.name} · {item.words.length}个单词 · {formatTime(item.timestamp)}</p>
                      </div>
                      <button
                        onClick={(e) => deleteHistory(item.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 px-2"
                      >
                        🗑️
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 收藏弹窗 */}
        {showFavorites && (
          <FavoritesModal
            favorites={favorites}
            onClose={() => setShowFavorites(false)}
            playAudio={playAudio}
          />
        )}

        {/* 步骤1：选择词库 */}
        {step === 1 && (
          <div className="animate-fadeIn">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">选择你要背的词汇</h2>
              <p className="text-gray-500">选择一个词库，或拍照/上传识别单词</p>
            </div>

            {/* 词库卡片 - 已移除数量显示 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
              {wordbanks.map(bank => (
                <button
                  key={bank.id}
                  onClick={() => { setSelectedBank(bank.id); setStep(2) }}
                  className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md border-2 border-transparent hover:border-indigo-300 transition-all text-left group"
                >
                  <div className="text-3xl mb-3">
                    {bank.id === 'ielts' && '🎓'}
                    {bank.id === 'cet4' && '📘'}
                    {bank.id === 'cet6' && '📗'}
                    {bank.id === 'gre' && '📕'}
                    {bank.id === 'toefl' && '📙'}
                  </div>
                  <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{bank.name}</h3>
                </button>
              ))}
            </div>

            {/* 拍照/上传识别 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-dashed border-gray-300">
              <div className="text-center">
                <p className="text-gray-600 font-medium mb-4">📸 拍照或上传识别单词</p>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={startCamera}
                    className="px-6 py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors flex items-center gap-2"
                  >
                    📷 拍照识别
                  </button>
                  <label className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors cursor-pointer flex items-center gap-2">
                    📁 上传图片
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                </div>
                <p className="text-xs text-gray-400 mt-3">支持单词书、试卷、笔记等文字识别</p>
              </div>
            </div>

            {/* 摄像头界面 */}
            {showCamera && (
              <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-4 max-w-lg w-full">
                  <div className="relative">
                    <video ref={videoRef} autoPlay playsInline className="w-full rounded-xl" />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button onClick={capturePhoto} className="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-medium">📸 拍照</button>
                    <button onClick={stopCamera} className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium">取消</button>
                  </div>
                </div>
              </div>
            )}

            {/* 识别结果预览 */}
            {capturedImage && (
              <div className="mt-6 bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex gap-4">
                  <img src={capturedImage} alt="识别图片" className="w-32 h-32 object-cover rounded-xl" />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-2">识别结果</h4>
                    {loading ? (
                      <div className="flex items-center gap-2 text-gray-500">
                        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        正在识别...
                      </div>
                    ) : (
                      <textarea
                        value={recognizedWords}
                        onChange={(e) => setRecognizedWords(e.target.value)}
                        className="w-full h-32 p-3 border border-gray-200 rounded-xl text-sm font-mono resize-none"
                        placeholder="识别到的单词会显示在这里，您可以编辑..."
                      />
                    )}
                  </div>
                </div>
                {!loading && recognizedWords && (
                  <button onClick={() => setStep(2)} className="mt-4 w-full py-3 bg-indigo-500 text-white rounded-xl font-medium">使用这些单词 →</button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 步骤2：填写作品信息 */}
        {step === 2 && (
          <div className="animate-fadeIn">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">填写你喜欢的作品</h2>
              <p className="text-gray-500">输入你喜欢的剧、小说、动漫或电影</p>
            </div>

            <button onClick={() => setStep(1)} className="mb-4 text-sm text-gray-500 hover:text-indigo-600 flex items-center gap-1">← 重新选择词库</button>

            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">作品名称 <span className="text-red-500">*</span></label>
                <input type="text" value={workTitle} onChange={(e) => setWorkTitle(e.target.value)} placeholder="例如：陷入我们的热恋、庆余年、鬼灭之刃..." className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">作品类型</label>
                <div className="flex gap-2 flex-wrap">
                  {['小说', '电视剧', '动漫', '电影'].map(type => (
                    <button key={type} onClick={() => setWorkType(type)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${workType === type ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{type}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">主要角色 <span className="text-gray-400 font-normal">（可选）</span></label>
                <input type="text" value={workCharacters} onChange={(e) => setWorkCharacters(e.target.value)} placeholder="例如：陈路周、徐栀..." className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">剧情简介 <span className="text-gray-400 font-normal">（可选）</span></label>
                <textarea value={workPlot} onChange={(e) => setWorkPlot(e.target.value)} placeholder="简单描述一下剧情，帮助AI更好地融入单词..." className="w-full h-24 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" />
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">已选词库：<span className="font-medium text-indigo-600">{wordbanks.find(b => b.id === selectedBank)?.name}</span></div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-500">单词数量</label>
                    <select value={wordCount} onChange={(e) => setWordCount(Number(e.target.value))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50">
                      {[10, 15, 20, 25, 30].map(n => <option key={n} value={n}>{n}个</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <button onClick={handleGenerate} disabled={!workTitle.trim() || loading} className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                {loading ? <span className="flex items-center justify-center gap-2"><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>AI正在创作中...</span> : '✨ 开始生成'}
              </button>
            </div>
          </div>
        )}

        {/* 步骤3：生成中 */}
        {step === 3 && (
          <div className="flex flex-col items-center justify-center py-32 animate-fadeIn">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-indigo-100 rounded-full" />
              <div className="w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
            </div>
            <h3 className="mt-8 text-xl font-bold text-gray-900">AI正在创作中...</h3>
            <p className="mt-2 text-gray-500 text-sm">正在将单词融入{workTitle}的剧情</p>
            <p className="mt-1 text-gray-400 text-xs">通常需要10-30秒</p>
          </div>
        )}

        {/* 步骤4：结果展示 */}
        {step === 4 && result && (
          <div className="animate-fadeIn">
            {/* 结果头部 */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white mb-6 shadow-lg shadow-indigo-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">{result.workInfo.title} × {result.wordbank.name}</h2>
                  <p className="text-indigo-100 text-sm mt-1">共 {result.words.length} 个单词</p>
                </div>
                <button onClick={handleReset} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors backdrop-blur-sm">重新开始</button>
              </div>
            </div>

            {/* 收藏操作栏 */}
            {selectedWords.size > 0 && (
              <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
                <span className="text-sm text-indigo-700">已选择 {selectedWords.size} 个单词</span>
                <button onClick={addToFavorites} className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors">⭐ 收藏选中</button>
              </div>
            )}

            {/* 单词列表 */}
            <div className="space-y-4">
              {result.words.map((item) => {
                const wordKey = `${result.id}_${item.index}`
                const isSelected = selectedWords.has(wordKey)
                const isExpanded = expandedWords.has(wordKey)
                const hasDetail = item.allMeanings || item.etymology
                return (
                  <div key={item.index} className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-all ${isSelected ? 'ring-2 ring-indigo-300' : ''}`}>
                    <div className="flex items-start gap-4 p-5">
                      {/* 选择框 */}
                      <button
                        onClick={() => toggleWordSelection(wordKey)}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 transition-colors ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 hover:border-indigo-400'}`}
                      >
                        {isSelected && <span className="text-white text-xs">✓</span>}
                      </button>
                      {/* 序号 */}
                      <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-indigo-600 font-bold text-sm">{item.index}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* 单词信息行 */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg font-bold text-gray-900">{item.word}</span>
                          <span className="text-sm text-gray-400 font-mono">{item.phonetic}</span>
                          <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full">{item.pos}</span>
                          <span className="text-sm text-gray-600">{item.meaning}</span>
                          {/* 发音按钮 */}
                          <div className="flex gap-1 ml-2">
                            <button onClick={() => playAudio(item.word, 'us')} className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100 transition-colors flex items-center gap-1" title="美式发音">🔊 美</button>
                            <button onClick={() => playAudio(item.word, 'uk')} className="px-2 py-1 bg-green-50 text-green-600 rounded text-xs hover:bg-green-100 transition-colors flex items-center gap-1" title="英式发音">🔊 英</button>
                          </div>
                          {/* 展开按钮 */}
                          {hasDetail && (
                            <button
                              onClick={() => toggleWordExpand(wordKey)}
                              className="ml-auto px-2 py-1 text-xs text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 flex-shrink-0"
                            >
                              {isExpanded ? '▲ 收起' : '▼ 展开'}
                            </button>
                          )}
                        </div>
                        {/* 剧情句子 */}
                        <p className="mt-2 text-gray-700 leading-relaxed">{highlightWord(item.sentence, item.word)}</p>
                      </div>
                    </div>
                    {/* 展开详情区域 */}
                    {isExpanded && hasDetail && (
                      <div className="px-5 pb-5 pt-0 ml-[72px]">
                        <div className="border-t border-gray-100 pt-4 space-y-3">
                          {/* 所有词性含义 */}
                          {item.allMeanings && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-2">
                                <span className="text-sm font-medium text-gray-700">📖 全部词义</span>
                              </div>
                              <div className="bg-blue-50/60 rounded-lg p-3">
                                {item.allMeanings.split(/[；;]/).filter(Boolean).map((m, i) => (
                                  <p key={i} className="text-sm text-gray-700 py-0.5">{m.trim()}</p>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* 词形变化/派生词 */}
                          {item.derivatives && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-2">
                                <span className="text-sm font-medium text-gray-700">🔄 词形变化</span>
                              </div>
                              <div className="bg-green-50/60 rounded-lg p-3">
                                <p className="text-sm text-gray-700 leading-relaxed">{item.derivatives}</p>
                              </div>
                            </div>
                          )}
                          {/* 词根记忆法 */}
                          {item.etymology && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-2">
                                <span className="text-sm font-medium text-gray-700">🧩 词根记忆</span>
                              </div>
                              <div className="bg-amber-50/60 rounded-lg p-3">
                                <p className="text-sm text-gray-700 leading-relaxed">{item.etymology}</p>
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

            {/* 底部操作 */}
            <div className="mt-8 flex justify-center gap-4">
              <button onClick={handleReset} className="px-6 py-2.5 border-2 border-gray-200 text-gray-600 rounded-xl font-medium hover:border-gray-300 transition-colors">← 重新选择</button>
              <button onClick={() => navigator.clipboard.writeText(formatForCopy(result.words))} className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors">📋 复制全部</button>
            </div>
          </div>
        )}
      </main>

      <footer className="text-center py-6 text-xs text-gray-400">WordStory - 让背单词变得有趣</footer>
    </div>
  )
}

// ==================== 工具函数 ====================
function highlightWord(sentence: string, word: string): React.ReactNode {
  const regex = new RegExp(`(${word})`, 'gi')
  const parts = sentence.split(regex)
  return parts.map((part, i) =>
    part.toLowerCase() === word.toLowerCase() ? <span key={i} className="font-bold text-indigo-600">{part}</span> : part
  )
}

function formatForCopy(words: WordResult[]): string {
  return words.map(w => `${w.index}. ${w.word} ${w.phonetic} ${w.pos} ${w.meaning}\n${w.sentence}`).join('\n\n')
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
    if (newExpanded.has(wordKey)) {
      newExpanded.delete(wordKey)
    } else {
      newExpanded.add(wordKey)
    }
    setExpandedWords(newExpanded)
  }

  const hasDetail = (word: WordResult) => word.allMeanings || word.etymology || word.derivatives

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-lg">⭐ 我的收藏</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="overflow-y-auto max-h-[60vh] p-4">
          {Object.keys(favorites).length === 0 ? (
            <div className="p-8 text-center text-gray-400">暂无收藏</div>
          ) : (
            Object.entries(favorites).map(([key, words]) => (
              <div key={key} className="mb-6">
                <h4 className="font-medium text-gray-700 mb-3 px-2">{key}</h4>
                <div className="space-y-2">
                  {words.map((word, idx) => {
                    const wordKey = `${key}_${idx}`
                    const isExpanded = expandedWords.has(wordKey)
                    const showExpand = hasDetail(word)
                    return (
                      <div key={idx} className="bg-gray-50 rounded-lg p-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => showExpand && toggleExpand(wordKey)}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900">{word.word}</span>
                          <span className="text-sm text-gray-400 font-mono">{word.phonetic}</span>
                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full">{word.pos}</span>
                          <span className="text-sm text-gray-600">{word.meaning}</span>
                          {/* 发音按钮 */}
                          <div className="flex gap-1 ml-auto" onClick={e => e.stopPropagation()}>
                            <button onClick={() => playAudio(word.word, 'us')} className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100 transition-colors flex items-center gap-1" title="美式发音">🔊 美</button>
                            <button onClick={() => playAudio(word.word, 'uk')} className="px-2 py-1 bg-green-50 text-green-600 rounded text-xs hover:bg-green-100 transition-colors flex items-center gap-1" title="英式发音">🔊 英</button>
                          </div>
                          {/* 展开指示 */}
                          {showExpand && (
                            <span className="text-xs text-indigo-500 ml-1">
                              {isExpanded ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-600">{word.sentence}</p>
                        {/* 展开详情 */}
                        {isExpanded && showExpand && (
                          <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
                            {word.allMeanings && (
                              <div>
                                <span className="text-xs font-medium text-gray-500">📖 全部词义</span>
                                <div className="bg-blue-50/60 rounded-lg p-2 mt-1">
                                  {word.allMeanings.split(/[；;]/).filter(Boolean).map((m, i) => (
                                    <p key={i} className="text-xs text-gray-700 py-0.5">{m.trim()}</p>
                                  ))}
                                </div>
                              </div>
                            )}
                            {word.derivatives && (
                              <div>
                                <span className="text-xs font-medium text-gray-500">🔄 词形变化</span>
                                <div className="bg-green-50/60 rounded-lg p-2 mt-1">
                                  <p className="text-xs text-gray-700">{word.derivatives}</p>
                                </div>
                              </div>
                            )}
                            {word.etymology && (
                              <div>
                                <span className="text-xs font-medium text-gray-500">🧩 词根记忆</span>
                                <div className="bg-amber-50/60 rounded-lg p-2 mt-1">
                                  <p className="text-xs text-gray-700">{word.etymology}</p>
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

export default App
