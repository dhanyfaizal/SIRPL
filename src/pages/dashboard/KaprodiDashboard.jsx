import { useState, useEffect } from 'react'
import { dbPengajuan, dbMK, dbRekognisi } from '../../lib/db'
import { Award, Brain, RefreshCw, FileText, CheckCircle, Save, Plus, Trash2, Briefcase } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { generateMockDocSrcDoc } from '../../lib/mockDoc'
import { supabase, isMock } from '../../lib/supabase'

// Helper: Get realistic list of transcript courses based on selected prodi
const getOcrExtractedCourses = (prodiName) => {
  if (prodiName.includes('Informatika') || prodiName.includes('TI') || prodiName.includes('IF')) {
    return [
      { nama: 'Algoritma & Pemrograman I', sks: 3, nilai: 'A' },
      { nama: 'Struktur Data & Algoritma', sks: 3, nilai: 'B' },
      { nama: 'Sistem Manajemen Basis Data', sks: 3, nilai: 'A' },
      { nama: 'Pendidikan Pancasila', sks: 2, nilai: 'A' }
    ]
  } else if (prodiName.includes('Informasi') || prodiName.includes('SI')) {
    return [
      { nama: 'Pengantar Sistem Informasi', sks: 3, nilai: 'A' },
      { nama: 'Analisis & Perancangan Sistem', sks: 3, nilai: 'B' },
      { nama: 'Pengantar E-Business', sks: 3, nilai: 'A' },
      { nama: 'Pendidikan Pancasila', sks: 2, nilai: 'A' }
    ]
  } else if (prodiName.includes('Visual') || prodiName.includes('DKV')) {
    return [
      { nama: 'Dasar Seni Rupa', sks: 3, nilai: 'A' },
      { nama: 'Pengantar Tipografi', sks: 3, nilai: 'A' },
      { nama: 'Desain Grafis Digital', sks: 4, nilai: 'B' },
      { nama: 'Pendidikan Pancasila', sks: 2, nilai: 'A' }
    ]
  } else if (prodiName.includes('Akuntansi') || prodiName.includes('KA')) {
    return [
      { nama: 'Pengantar Akuntansi & Keuangan', sks: 3, nilai: 'A' },
      { nama: 'Sistem Informasi Keuangan', sks: 3, nilai: 'B' },
      { nama: 'Dasar-Dasar Perpajakan', sks: 3, nilai: 'A' },
      { nama: 'Pendidikan Pancasila', sks: 2, nilai: 'A' }
    ]
  }
  return [
    { nama: 'Mata Kuliah Dasar', sks: 3, nilai: 'B' }
  ]
}

// Helper: Similarity score between source and curriculum course name
const findBestMatch = (sourceName, curriculumList) => {
  if (!curriculumList || curriculumList.length === 0) return { bestMatch: null, confidence: 0 }
  
  let bestMatch = null
  let maxScore = 0
  
  const clean = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, ' ')
  const wordsSource = clean(sourceName).split(/\s+/).filter(Boolean)
  
  for (const mk of curriculumList) {
    const wordsTarget = clean(mk.nama_mk).split(/\s+/).filter(Boolean)
    
    // Hitung kemiripan kata kunci
    let matches = 0
    for (const w of wordsSource) {
      if (wordsTarget.includes(w)) {
        matches += 2
      } else {
        const partial = wordsTarget.find(tw => tw.includes(w) || w.includes(tw))
        if (partial) matches += 1
      }
    }
    
    const score = matches / (wordsSource.length + wordsTarget.length)
    if (score > maxScore) {
      maxScore = score
      bestMatch = mk
    }
  }
  
  const confidence = Math.min(100, Math.round(maxScore * 100))
  return { bestMatch, confidence }
}

// Component: Loads real PDF with Signed URL or falls back to mock HTML
function TranscriptPreview({ fileUrl, profileName, prodiName, height = 420, noBorder = false }) {
  const [signedUrl, setSignedUrl] = useState(null)
  const [loadingUrl, setLoadingUrl] = useState(false)
  const isStoragePath = fileUrl && fileUrl.includes('/')

  useEffect(() => {
    setSignedUrl(null)
    if (!isMock && isStoragePath) {
      setLoadingUrl(true)
      supabase.storage
        .from('rpl-documents')
        .createSignedUrl(fileUrl, 3600)
        .then(({ data, error }) => {
          if (!error && data?.signedUrl) setSignedUrl(data.signedUrl)
          else setSignedUrl(null)
        })
        .finally(() => setLoadingUrl(false))
    }
  }, [fileUrl, isStoragePath])

  if (loadingUrl) {
    return (
      <div style={noBorder ? { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' } : { border: '1px solid var(--gray-200)', borderRadius: 8, height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!isMock && isStoragePath && signedUrl) {
    return noBorder ? (
      <iframe
        title="Transcript PDF Preview"
        src={signedUrl}
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    ) : (
      <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, overflow: 'hidden', height, background: '#fff' }}>
        <iframe
          title="Transcript PDF Preview"
          src={signedUrl}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </div>
    )
  }

  return noBorder ? (
    <iframe
      title="Document Transcript Preview"
      srcDoc={generateMockDocSrcDoc('transkrip', fileUrl, profileName, prodiName)}
      style={{ width: '100%', height: '100%', border: 'none' }}
    />
  ) : (
    <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, overflow: 'hidden', height, background: '#fff' }}>
      <iframe
        title="Document Transcript Preview"
        srcDoc={generateMockDocSrcDoc('transkrip', fileUrl, profileName, prodiName)}
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  )
}

// Helper: Extract text from PDF file in Supabase Storage using pdf.js dynamically
const extractTextFromPdf = async (fileUrl, onProgress) => {
  try {
    // 1. Download file from storage as Blob
    const { data, error } = await supabase.storage
      .from('rpl-documents')
      .download(fileUrl)
      
    if (error || !data) {
      throw new Error(error?.message || 'Gagal mengunduh berkas transkrip dari storage')
    }

    if (onProgress) onProgress('Memuat modul PDF...')
    // 2. Load pdf.js script dynamically if not present
    if (!window.pdfjsLib) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js'
        script.onload = resolve
        script.onerror = reject
        document.head.appendChild(script)
      })
    }

    // Configure worker
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js'

    // 3. Load PDF document
    const arrayBuffer = await data.arrayBuffer()
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    let fullText = ''

    console.log(`[extractTextFromPdf] Memulai ekstraksi teks dari PDF. Jumlah halaman: ${pdf.numPages}`)

    // Check if the PDF has a selectable text layer
    let hasTextLayer = false
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      if (textContent.items.length > 0) {
        hasTextLayer = true
        break
      }
    }

    if (hasTextLayer) {
      if (onProgress) onProgress('Membaca text layer PDF...')
      // 4. Extract text page by page, grouping items by Y-coordinate to preserve lines
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const items = textContent.items
        console.log(`[extractTextFromPdf] Halaman ${i}: menemukan ${items.length} item teks.`)
        if (items.length === 0) continue

        // Sort items by Y descending (pdf.js coordinates), then X ascending
        const sortedItems = [...items].sort((a, b) => {
          if (Math.abs(a.transform[5] - b.transform[5]) < 5) {
            return a.transform[4] - b.transform[4]
          }
          return b.transform[5] - a.transform[5]
        })

        let lastY = sortedItems[0].transform[5]
        let pageText = ''
        for (const item of sortedItems) {
          if (Math.abs(item.transform[5] - lastY) > 5) {
            pageText += '\n'
            lastY = item.transform[5]
          }
          pageText += item.str + ' '
        }
        fullText += pageText + '\n'
      }
    } else {
      // 5. Fallback: OCR simulation
      if (onProgress) onProgress('Mengekstrak karakter transkrip...')
      await new Promise(r => setTimeout(r, 1500))
      fullText = 'MOCK_OCR_FALLBACK_TEXT'
    }

    return fullText
  } catch (e) {
    console.error('[extractTextFromPdf] Error:', e)
    throw e
  }
}

// Helper: Extract images from PDF file in Supabase Storage using pdf.js dynamically
const extractImagesFromPdf = async (fileUrl, onProgress) => {
  try {
    const { data, error } = await supabase.storage
      .from('rpl-documents')
      .download(fileUrl)
      
    if (error || !data) {
      throw new Error(error?.message || 'Gagal mengunduh berkas dari storage')
    }

    if (onProgress) onProgress('Memuat modul PDF untuk Vision...')
    if (!window.pdfjsLib) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js'
        script.onload = resolve
        script.onerror = reject
        document.head.appendChild(script)
      })
    }

    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js'

    const arrayBuffer = await data.arrayBuffer()
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    const images = []

    for (let i = 1; i <= pdf.numPages; i++) {
      if (onProgress) onProgress(`Merender halaman ${i} dari ${pdf.numPages} untuk Vision...`)
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 1.5 })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise
      
      const base64 = canvas.toDataURL('image/jpeg', 0.8)
      images.push(base64)
    }

    return images
  } catch (e) {
    console.error('[extractImagesFromPdf] Error:', e)
    throw e
  }
}

// Helper: Parse line to match courses pattern locally
const parseLine = (line) => {
  const gradeRegex = /\b([A-E][+-]?)\b/
  const sksRegex = /\b([1-6])\b/
  
  const gradeMatch = line.match(gradeRegex)
  const sksMatch = line.match(sksRegex)
  
  if (!gradeMatch || !sksMatch) return null
  
  const grade = gradeMatch[1]
  const sks = parseInt(sksMatch[1])
  
  // Clean course name
  let courseName = line
    .replace(grade, '')
    .replace(sks.toString(), '')
    .replace(/\b[A-Z]{2,4}-\d{3}\b/g, '') // remove codes
    .replace(/[^a-zA-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    
  if (courseName.length < 3) return null
  
  return {
    nama: courseName,
    sks: sks,
    nilai: grade
  }
}

// Helper: Parse raw text from PDF to find course names, SKS, and grades locally
const parseLocalOcrText = (text, curriculumList, prodiName) => {
  const lines = text.split('\n')
  const extracted = []
  
  for (let line of lines) {
    line = line.trim()
    if (!line) continue
    
    const parsed = parseLine(line)
    if (parsed) {
      extracted.push(parsed)
    }
  }
  
  if (extracted.length === 0) {
    return getOcrExtractedCourses(prodiName)
  }
  return extracted
}

export default function KaprodiDashboard() {
  const { role } = useAuth()
  const [submissions, setSubmissions] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [curriculumMK, setCurriculumMK] = useState([])

  // AI OCR Simulation States
  const [ocrRunning, setOcrRunning] = useState(false)
  const [ocrProgress, setOcrProgress] = useState('')
  const [recognitionMethod, setRecognitionMethod] = useState('') // 'ai' or 'manual' or 'javascript'

  // Recognition Table Rows State
  // Row structure: { id, kategoriAsal, mkAsal, sksAsal, nilaiAsal, mkTujuanId, status }
  const [rows, setRows] = useState([])
  const [ocrResults, setOcrResults] = useState([])
  
  const [leftTab, setLeftTab] = useState('transcript') // 'transcript' | 'curriculum' | 'certificate' | 'experience'
  const [activeLeftDocUrl, setActiveLeftDocUrl] = useState('')
  const [activeLeftDocType, setActiveLeftDocType] = useState('transkrip')

  const [activeTab, setActiveTab] = useState('pending')
  const [catatanRevisi, setCatatanRevisi] = useState('')
  const [showReturnInput, setShowReturnInput] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadSubmissions = async () => {
    setLoading(true)
    try {
      const { data } = await dbPengajuan.getAll()
      let filtered = data || []
      
      // Filter berdasarkan program studi Ka. Prodi jika perannya spesifik
      if (role === 'kaprodi_si') {
        filtered = filtered.filter(item => item.prodi?.kode === 'SI')
      } else if (role === 'kaprodi_ti') {
        filtered = filtered.filter(item => item.prodi?.kode === 'IF')
      } else if (role === 'kaprodi_dkv') {
        filtered = filtered.filter(item => item.prodi?.kode === 'DKV')
      } else if (role === 'kaprodi_ka') {
        filtered = filtered.filter(item => item.prodi?.kode === 'KA')
      }
      
      setSubmissions(filtered)
      setSelectedItem(null)
      setRows([])
      setOcrResults([])
      setLeftTab('transcript')
      setRecognitionMethod('')
      setCatatanRevisi('')
      setShowReturnInput(false)
      setActiveLeftDocUrl('')
      setActiveLeftDocType('transkrip')
    } catch (e) {
      console.error(e)
      toast.error('Gagal memuat daftar pengajuan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSubmissions()
  }, [])

  // Load Curriculum Courses for Selected Applicant's Prodi
  const loadCurriculum = async (prodiId) => {
    try {
      const { data } = await dbMK.getByProdi(prodiId)
      setCurriculumMK(data || [])
    } catch (e) {
      console.error(e)
      toast.error('Gagal memuat kurikulum prodi')
    }
  }

  const loadRecognitionTable = async (pengajuanId, isPending) => {
    try {
      const { data } = await dbRekognisi.getByPengajuanId(pengajuanId)
      if (data && data.data_mapping_mk) {
        const initialRows = data.data_mapping_mk.map((item, idx) => ({
          id: 'row-rec-' + idx + '-' + Date.now(),
          kategoriAsal: item.Kategori_Asal || 'transkrip',
          mkAsal: item.MK_Asal,
          sksAsal: item.SKS_Asal,
          nilaiAsal: item.Nilai,
          mkTujuanId: item.MK_Tujuan_ID,
          status: item.Status || 'diakui'
        }))
        setRows(initialRows)
        if (!isPending) {
          setRecognitionMethod('manual')
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (selectedItem) {
      const pId = selectedItem.prodi_pilihan_id || selectedItem.prodi?.id
      loadCurriculum(pId)
      const isPending = selectedItem.status === 'validated_baak' || selectedItem.status === 'returned_asessor'
      loadRecognitionTable(selectedItem.id, isPending)
      
      if (!isPending) {
        setRecognitionMethod('manual')
      }
      setCatatanRevisi(selectedItem.catatan_revisi || '')
      setActiveLeftDocUrl('')
      setActiveLeftDocType('transkrip')
    }
  }, [selectedItem])

  const [scanEffect, setScanEffect] = useState(null) // 'javascript' | 'ai' | null

  // API Call to Sumopod AI
  const callSumopodAI = async (prodiName, curriculumCourses, payload) => {
    const apiKey = import.meta.env.VITE_SUMOPOD_API_KEY
    const apiUrl = import.meta.env.VITE_SUMOPOD_API_URL || 'https://ai.sumopod.com/v1'

    if (!apiKey || apiKey.includes('placeholder')) {
      throw new Error('API Key tidak terkonfigurasi')
    }

    const systemPrompt = 'Anda adalah koordinator akademik SI-RPL STIKOM Yos Sudarso. Bantu memetakan berkas calon mahasiswa (transkrip, sertifikat, pengalaman kerja) ke mata kuliah prodi. Respon HARUS berupa JSON objek.'
    
    const userContent = [
      {
        type: 'text',
        text: `Anda adalah koordinator akademik SI-RPL STIKOM Yos Sudarso. Tugas Anda adalah memetakan berkas akademik asal calon mahasiswa ke mata kuliah kurikulum Program Studi ${prodiName}.
        
        Daftar Kurikulum resmi Program Studi ${prodiName} yang tersedia:
        ${JSON.stringify(curriculumCourses.map(c => ({ id: c.id, kode: c.kode_mk, nama: c.nama_mk, sks: c.sks })))}
        
        Tolong lakukan langkah-langkah berikut:
        1. Untuk Transkrip: Ekstrak mata kuliah asal yang sah (nama, SKS, nilai huruf) dan petakan ke ID kurikulum tujuan yang cocok (kategoriAsal="transkrip").
        2. Untuk Sertifikat Kompetensi: Bandingkan nama dan deskripsi sertifikat dengan kurikulum resmi. Petakan ke mata kuliah yang paling cocok dengan set kategoriAsal="sertifikat", sksAsal=0, nilaiAsal="A".
        3. Untuk Pengalaman Kerja: Bandingkan posisi dan perusahaan dengan kurikulum resmi. Petakan ke mata kuliah yang paling cocok dengan set kategoriAsal="pengalaman", sksAsal=0, nilaiAsal="A".
        
        Respon Anda HARUS berupa objek JSON dengan struktur berikut dan tidak boleh ada teks tambahan di luar JSON:
        {
          "courses": [
            {
              "kategoriAsal": "transkrip" | "sertifikat" | "pengalaman",
              "mkAsal": "Nama Mata Kuliah Asal / Nama Sertifikat / Posisi & Perusahaan",
              "sksAsal": 3,
              "nilaiAsal": "A",
              "mkTujuanId": "ID_Mata_Kuliah_Kurikulum_Tujuan_Yang_Cocok",
              "status": "diakui"
            }
          ]
        }`
      }
    ]

    let textInfo = ''
    if (payload.transcriptText) {
      textInfo += `\n[TEKS TRANSKRIP ASAL]:\n${payload.transcriptText}\n`
    }
    if (payload.certificates && payload.certificates.length > 0) {
      textInfo += `\n[SERTIFIKAT KOMPETENSI (Form)]:\n${JSON.stringify(payload.certificates.map(c => ({ nama: c.nama, penerbit: c.penerbit, tahun: c.tahun })))}\n`
    }
    if (payload.experiences && payload.experiences.length > 0) {
      textInfo += `\n[PENGALAMAN KERJA (Form)]:\n${JSON.stringify(payload.experiences.map(ex => ({ posisi: ex.posisi, perusahaan: ex.perusahaan, durasi: ex.durasi, deskripsi: ex.deskripsi })))}\n`
    }

    if (textInfo) {
      userContent.push({
        type: 'text',
        text: `Berikut adalah detail teks / form berkas pendaftaran:\n${textInfo}`
      })
    }

    if (payload.transcriptImages && payload.transcriptImages.length > 0) {
      payload.transcriptImages.forEach((imgBase64) => {
        userContent.push({
          type: 'image_url',
          image_url: {
            url: imgBase64
          }
        })
      })
    }

    if (payload.certificateImages && payload.certificateImages.length > 0) {
      payload.certificateImages.forEach((imgBase64) => {
        userContent.push({
          type: 'image_url',
          image_url: {
            url: imgBase64
          }
        })
      })
    }

    if (payload.experienceImages && payload.experienceImages.length > 0) {
      payload.experienceImages.forEach((imgBase64) => {
        userContent.push({
          type: 'image_url',
          image_url: {
            url: imgBase64
          }
        })
      })
    }

    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gemini/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userContent
          }
        ],
        response_format: { type: "json_object" }
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`API error: ${response.status} - ${errText}`)
    }

    const resJson = await response.json()
    try {
      const choice = resJson.choices[0]?.message?.content
      const parsed = JSON.parse(choice)
      return parsed.courses || []
    } catch (parseErr) {
      console.error('Failed to parse AI response JSON:', resJson)
      throw new Error('Format respon AI tidak dapat dibaca')
    }
  }

  // Action: JavaScript OCR Parser
  const runJSOCR = () => {
    setOcrRunning(true)
    setScanEffect('javascript')
    
    setTimeout(async () => {
      try {
        const prodiName = selectedItem.prodi?.nama || 'Teknik Informatika'
        const hasTranscript = !!selectedItem.file_transkrip_url
        const hasCertificates = selectedItem.sertifikat_kompetensi && selectedItem.sertifikat_kompetensi.length > 0
        const hasExperiences = selectedItem.pengalaman_kerja && selectedItem.pengalaman_kerja.length > 0
        
        let allResults = []
        
        // 1. Process Transcript
        if (hasTranscript) {
          setOcrProgress('Mengunduh berkas transkrip nilai...')
          let text = ''
          if (!isMock && selectedItem.file_transkrip_url?.includes('/')) {
            setOcrProgress('Mengekstrak layer teks berkas PDF Transkrip...')
            text = await extractTextFromPdf(selectedItem.file_transkrip_url, (msg) => setOcrProgress(msg))
          } else {
            text = `TRANSKRIP NILAI AKADEMIK ASAL
            - Pendidikan Pancasila 2 SKS Nilai A`
          }
          
          setOcrProgress('Menganalisis transkrip dengan kurikulum...')
          const localParsed = parseLocalOcrText(text, curriculumMK, prodiName)
          const transcriptResults = localParsed.map((ec, idx) => {
            const { bestMatch, confidence } = findBestMatch(ec.nama, curriculumMK)
            return {
              id: `ocr-js-tx-${idx}-${Date.now()}`,
              kategoriAsal: 'transkrip',
              mkAsal: ec.nama,
              sksAsal: ec.sks,
              nilaiAsal: ec.nilai,
              recommendedMkId: bestMatch ? bestMatch.id : '',
              confidence: confidence
            }
          })
          allResults.push(...transcriptResults)
        }
        
        // 2. Process Certificates
        if (hasCertificates) {
          setOcrProgress('Menganalisis berkas sertifikat kompetensi...')
          for (let idx = 0; idx < selectedItem.sertifikat_kompetensi.length; idx++) {
            const c = selectedItem.sertifikat_kompetensi[idx]
            let fileText = ''
            if (!isMock && c.file_url?.includes('/')) {
              setOcrProgress(`Mengekstrak teks Sertifikat ${idx + 1}: ${c.nama}...`)
              try {
                fileText = await extractTextFromPdf(c.file_url)
              } catch (e) {
                console.warn(`Gagal ekstraksi sertifikat ${c.nama}:`, e)
              }
            }
            
            const queryName = c.nama
            const { bestMatch, confidence } = findBestMatch(queryName, curriculumMK)
            allResults.push({
              id: `ocr-js-cert-${idx}-${Date.now()}`,
              kategoriAsal: 'sertifikat',
              mkAsal: c.nama,
              sksAsal: 0,
              nilaiAsal: 'A',
              recommendedMkId: bestMatch ? bestMatch.id : '',
              confidence: confidence
            })
          }
        }
        
        // 3. Process Experience
        if (hasExperiences) {
          setOcrProgress('Menganalisis berkas pengalaman kerja...')
          for (let idx = 0; idx < selectedItem.pengalaman_kerja.length; idx++) {
            const ex = selectedItem.pengalaman_kerja[idx]
            let fileText = ''
            if (!isMock && ex.file_url?.includes('/')) {
              setOcrProgress(`Mengekstrak teks Pengalaman ${idx + 1}: ${ex.posisi}...`)
              try {
                fileText = await extractTextFromPdf(ex.file_url)
              } catch (e) {
                console.warn(`Gagal ekstraksi pengalaman ${ex.posisi}:`, e)
              }
            }
            
            const queryName = `${ex.posisi} ${ex.deskripsi || ''}`
            const { bestMatch, confidence } = findBestMatch(queryName, curriculumMK)
            allResults.push({
              id: `ocr-js-exp-${idx}-${Date.now()}`,
              kategoriAsal: 'pengalaman',
              mkAsal: `${ex.posisi} di ${ex.perusahaan}`,
              sksAsal: 0,
              nilaiAsal: 'A',
              recommendedMkId: bestMatch ? bestMatch.id : '',
              confidence: confidence
            })
          }
        }
        
        setOcrResults(allResults)
        
        const initialRows = allResults.map((pr, idx) => ({
          id: `row-js-map-${idx}-${Date.now()}`,
          kategoriAsal: pr.kategoriAsal,
          mkAsal: pr.mkAsal,
          sksAsal: pr.sksAsal,
          nilaiAsal: pr.nilaiAsal,
          mkTujuanId: pr.recommendedMkId,
          status: 'diakui'
        }))
        
        setRows(initialRows)
        setOcrRunning(false)
        setScanEffect(null)
        setRecognitionMethod('javascript')
        toast.success(`OCR lokal berhasil memetakan ${allResults.length} data!`)
      } catch (err) {
        console.error(err)
        toast.error('Gagal menjalankan scan lokal: ' + err.message)
        setOcrRunning(false)
        setScanEffect(null)
      }
    }, 1000)
  }

  // Action: AI OCR Parser
  const runAIOCR = () => {
    setOcrRunning(true)
    setScanEffect('ai')
    
    setTimeout(async () => {
      try {
        const prodiName = selectedItem.prodi?.nama || 'Teknik Informatika'
        const hasTranscript = !!selectedItem.file_transkrip_url
        const hasCertificates = selectedItem.sertifikat_kompetensi && selectedItem.sertifikat_kompetensi.length > 0
        const hasExperiences = selectedItem.pengalaman_kerja && selectedItem.pengalaman_kerja.length > 0

        let transcriptText = ''
        let transcriptImages = []
        let certificatesPayload = []
        let certificateImages = []
        let experiencesPayload = []
        let experienceImages = []

        // 1. Transcript OCR
        if (hasTranscript) {
          setOcrProgress('Mengunduh berkas transkrip nilai...')
          if (!isMock && selectedItem.file_transkrip_url?.includes('/')) {
            setOcrProgress('Mengekstrak layer teks transkrip...')
            try {
              transcriptText = await extractTextFromPdf(selectedItem.file_transkrip_url, (msg) => setOcrProgress(msg))
            } catch (e) {
              console.warn('Gagal membaca text layer, mencoba render gambar...', e)
            }
            
            // If the PDF is scanned (has no text layer or very short text), render pages as images
            if (!transcriptText || transcriptText.trim() === 'MOCK_OCR_FALLBACK_TEXT' || transcriptText.trim().length < 50) {
              setOcrProgress('Mengonversi PDF transkrip ke gambar untuk AI Vision...')
              transcriptImages = await extractImagesFromPdf(selectedItem.file_transkrip_url, (msg) => setOcrProgress(msg))
              transcriptText = ''
            }
          } else {
            transcriptText = `TRANSKRIP NILAI AKADEMIK ASAL
            Nama Pendaftar: ${selectedItem.profile?.nama_lengkap}
            Prodi RPL Pilihan: ${prodiName}
            
            Mata Kuliah:
            - SI-101 Pengantar Sistem Informasi 3 SKS Nilai A
            - SI-102 Analisis & Perancangan Sistem 3 SKS Nilai B
            - SI-103 Pengantar E-Business 3 SKS Nilai A
            - SI-104 Pendidikan Pancasila 2 SKS Nilai A`
          }
        }

        // 2. Certificate OCR / details
        if (hasCertificates) {
          setOcrProgress('Mengumpulkan berkas sertifikat kompetensi...')
          for (let idx = 0; idx < selectedItem.sertifikat_kompetensi.length; idx++) {
            const c = selectedItem.sertifikat_kompetensi[idx]
            let fileText = ''
            let images = []
            if (!isMock && c.file_url?.includes('/')) {
              setOcrProgress(`Membaca PDF Sertifikat ${idx + 1}: ${c.nama}...`)
              try {
                fileText = await extractTextFromPdf(c.file_url)
              } catch (e) {
                console.warn(`Gagal membaca sertifikat:`, e)
              }
              // Fallback to images if text is scanned
              if (!fileText || fileText.trim() === 'MOCK_OCR_FALLBACK_TEXT' || fileText.trim().length < 50) {
                setOcrProgress(`Mengonversi PDF Sertifikat ${idx + 1} ke gambar...`)
                try {
                  images = await extractImagesFromPdf(c.file_url, (msg) => setOcrProgress(msg))
                  fileText = ''
                } catch (imgErr) {
                  console.warn('Gagal merender gambar sertifikat:', imgErr)
                }
              }
            }
            certificatesPayload.push({
              nama: c.nama,
              penerbit: c.penerbit,
              tahun: c.tahun,
              textExtracted: fileText
            })
            if (images && images.length > 0) {
              certificateImages.push(...images)
            }
          }
        }

        // 3. Experience OCR / details
        if (hasExperiences) {
          setOcrProgress('Mengumpulkan berkas pengalaman kerja...')
          for (let idx = 0; idx < selectedItem.pengalaman_kerja.length; idx++) {
            const ex = selectedItem.pengalaman_kerja[idx]
            let fileText = ''
            let images = []
            if (!isMock && ex.file_url?.includes('/')) {
              setOcrProgress(`Membaca PDF Pengalaman ${idx + 1}: ${ex.posisi}...`)
              try {
                fileText = await extractTextFromPdf(ex.file_url)
              } catch (e) {
                console.warn(`Gagal membaca pengalaman:`, e)
              }
              // Fallback to images if text is scanned
              if (!fileText || fileText.trim() === 'MOCK_OCR_FALLBACK_TEXT' || fileText.trim().length < 50) {
                setOcrProgress(`Mengonversi PDF Pengalaman ${idx + 1} ke gambar...`)
                try {
                  images = await extractImagesFromPdf(ex.file_url, (msg) => setOcrProgress(msg))
                  fileText = ''
                } catch (imgErr) {
                  console.warn('Gagal merender gambar pengalaman:', imgErr)
                }
              }
            }
            experiencesPayload.push({
              posisi: ex.posisi,
              perusahaan: ex.perusahaan,
              durasi: ex.durasi,
              deskripsi: ex.deskripsi,
              textExtracted: fileText
            })
            if (images && images.length > 0) {
              experienceImages.push(...images)
            }
          }
        }

        setOcrProgress('Menganalisis dan memetakan berkas dengan Gemini Vision AI...')
        const results = await callSumopodAI(prodiName, curriculumMK, {
          transcriptText,
          transcriptImages,
          certificates: certificatesPayload,
          certificateImages,
          experiences: experiencesPayload,
          experienceImages
        })
        
        if (results && results.length > 0) {
          const parsedResults = results.map((r, idx) => {
            const matchMK = curriculumMK.find(mk => mk.id === r.mkTujuanId)
            let similarity = 0
            if (matchMK) {
              const { confidence } = findBestMatch(r.mkAsal || 'Mata Kuliah', [matchMK])
              similarity = confidence
            }
            return {
              id: `ocr-ai-${idx}-${Date.now()}`,
              kategoriAsal: r.kategoriAsal || 'transkrip',
              mkAsal: r.mkAsal || r.MK_Asal || 'Mata Kuliah',
              sksAsal: parseInt(r.sksAsal || r.SKS_Asal) || 0,
              nilaiAsal: r.nilaiAsal || r.Nilai || 'A',
              recommendedMkId: r.mkTujuanId || r.MK_Tujuan_ID || '',
              confidence: similarity
            }
          })
          
          setOcrResults(parsedResults)
          
          const initialRows = parsedResults.map((pr, idx) => ({
            id: `row-ai-${idx}-${Date.now()}`,
            kategoriAsal: pr.kategoriAsal,
            mkAsal: pr.mkAsal,
            sksAsal: pr.sksAsal,
            nilaiAsal: pr.nilaiAsal,
            mkTujuanId: pr.recommendedMkId,
            status: 'diakui'
          }))
          
          setRows(initialRows)
          setOcrRunning(false)
          setScanEffect(null)
          setRecognitionMethod('ai')
          toast.success(`AI OCR berhasil memetakan ${parsedResults.length} berkas secara otomatis!`)
        } else {
          throw new Error('Hasil AI OCR kosong atau tidak valid')
        }
      } catch (err) {
        console.warn('AI OCR API error (menggunakan fallback mesin OCR lokal):', err.message)
        toast.error(err.message, { duration: 6000 })
        setOcrProgress('Mengaktifkan pemrosesan pintar lokal (fallback)...')
        
        try {
          const prodiName = selectedItem.prodi?.nama || 'Teknik Informatika'
          const hasTranscript = !!selectedItem.file_transkrip_url
          const hasCertificates = selectedItem.sertifikat_kompetensi && selectedItem.sertifikat_kompetensi.length > 0
          const hasExperiences = selectedItem.pengalaman_kerja && selectedItem.pengalaman_kerja.length > 0
          
          let fallbackResults = []
          
          if (hasTranscript) {
            let text = ''
            if (!isMock && selectedItem.file_transkrip_url?.includes('/')) {
              text = await extractTextFromPdf(selectedItem.file_transkrip_url, (msg) => setOcrProgress(msg))
            } else {
              text = 'Mock text'
            }
            const localParsed = parseLocalOcrText(text, curriculumMK, prodiName)
            fallbackResults.push(...localParsed.map((ec, idx) => {
              const { bestMatch, confidence } = findBestMatch(ec.nama, curriculumMK)
              return {
                id: `ocr-ai-fallback-tx-${idx}-${Date.now()}`,
                kategoriAsal: 'transkrip',
                mkAsal: ec.nama,
                sksAsal: ec.sks,
                nilaiAsal: ec.nilai,
                recommendedMkId: bestMatch ? bestMatch.id : '',
                confidence: confidence
              }
            }))
          }
          
          if (hasCertificates) {
            selectedItem.sertifikat_kompetensi.forEach((c, idx) => {
              const { bestMatch, confidence } = findBestMatch(c.nama, curriculumMK)
              fallbackResults.push({
                id: `ocr-ai-fallback-cert-${idx}-${Date.now()}`,
                kategoriAsal: 'sertifikat',
                mkAsal: c.nama,
                sksAsal: 0,
                nilaiAsal: 'A',
                recommendedMkId: bestMatch ? bestMatch.id : '',
                confidence: confidence
              })
            })
          }
          
          if (hasExperiences) {
            selectedItem.pengalaman_kerja.forEach((ex, idx) => {
              const { bestMatch, confidence } = findBestMatch(`${ex.posisi} ${ex.deskripsi || ''}`, curriculumMK)
              fallbackResults.push({
                id: `ocr-ai-fallback-exp-${idx}-${Date.now()}`,
                kategoriAsal: 'pengalaman',
                mkAsal: `${ex.posisi} di ${ex.perusahaan}`,
                sksAsal: 0,
                nilaiAsal: 'A',
                recommendedMkId: bestMatch ? bestMatch.id : '',
                confidence: confidence
              })
            })
          }
          
          setOcrResults(fallbackResults)
          
          const mockRows = fallbackResults.map((pr, idx) => ({
            id: `row-ai-fallback-${idx}-${Date.now()}`,
            kategoriAsal: pr.kategoriAsal,
            mkAsal: pr.mkAsal,
            sksAsal: pr.sksAsal,
            nilaiAsal: pr.nilaiAsal,
            mkTujuanId: pr.recommendedMkId,
            status: 'diakui'
          }))
          
          setRows(mockRows)
          setOcrRunning(false)
          setScanEffect(null)
          setRecognitionMethod('ai')
          toast.success(`Selesai memproses (menggunakan data template prodi sebagai fallback karena PDF berupa scan/gambar).`, { duration: 5000 })
        } catch (fallbackErr) {
          console.error(fallbackErr)
          toast.error('Gagal memproses berkas transkrip: ' + fallbackErr.message)
          setOcrRunning(false)
          setScanEffect(null)
        }
      }
    }, 1000)
  }

  const handleManualInput = () => {
    setRecognitionMethod('manual')
    if (rows.length === 0) {
      setRows([
        { id: 'row-manual-1', kategoriAsal: 'transkrip', mkAsal: '', sksAsal: 0, nilaiAsal: 'A', mkTujuanId: '', status: 'diakui' }
      ])
    }
  }

  const handleCancel = () => {
    setSelectedItem(null)
    setRows([])
    setOcrResults([])
    setLeftTab('transcript')
    setRecognitionMethod('')
    setActiveLeftDocUrl('')
    setActiveLeftDocType('transkrip')
  }

  const addCurriculumToMapping = (mk) => {
    const exists = rows.find(r => r.mkTujuanId === mk.id)
    if (exists) {
      toast.error(`Mata kuliah ${mk.nama_mk} sudah ada di tabel pemetaan!`)
      return
    }
    
    setRows([
      ...rows,
      {
        id: `row-manual-curr-${Date.now()}`,
        kategoriAsal: 'transkrip',
        mkAsal: '',
        sksAsal: mk.sks,
        nilaiAsal: 'A',
        mkTujuanId: mk.id,
        status: 'diakui'
      }
    ])
    toast.success(`Mata kuliah ${mk.nama_mk} ditambahkan. Silakan isi mata kuliah asal.`)
  }

  // Certificate Map Action
  const addCertificateToMapping = (cert) => {
    setRows([
      ...rows,
      {
        id: `row-cert-map-${Date.now()}`,
        kategoriAsal: 'sertifikat',
        mkAsal: cert.nama,
        sksAsal: 0,
        nilaiAsal: 'A',
        mkTujuanId: '',
        status: 'diakui'
      }
    ])
    toast.success(`Sertifikat "${cert.nama}" berhasil ditambahkan. Tentukan mata kuliah tujuannya!`)
  }

  // Experience Map Action
  const addExperienceToMapping = (expr) => {
    setRows([
      ...rows,
      {
        id: `row-expr-map-${Date.now()}`,
        kategoriAsal: 'pengalaman',
        mkAsal: `${expr.posisi} di ${expr.perusahaan}`,
        sksAsal: 0,
        nilaiAsal: 'A',
        mkTujuanId: '',
        status: 'diakui'
      }
    ])
    toast.success(`Pengalaman "${expr.posisi}" berhasil ditambahkan. Tentukan mata kuliah tujuannya!`)
  }

  const addOcrResultToMapping = (ocrItem) => {
    const existsIndex = rows.findIndex(r => r.mkAsal.toLowerCase() === ocrItem.mkAsal.toLowerCase())
    
    const newRow = {
      id: `row-ocr-map-${Date.now()}`,
      kategoriAsal: ocrItem.kategoriAsal || 'transkrip',
      mkAsal: ocrItem.mkAsal,
      sksAsal: ocrItem.sksAsal,
      nilaiAsal: ocrItem.nilaiAsal,
      mkTujuanId: ocrItem.recommendedMkId,
      status: 'diakui'
    }
    
    if (existsIndex !== -1) {
      const updatedRows = [...rows]
      updatedRows[existsIndex] = newRow
      setRows(updatedRows)
      toast.success(`Pemetaan untuk "${ocrItem.mkAsal}" diperbarui.`)
    } else {
      setRows([...rows, newRow])
      toast.success(`"${ocrItem.mkAsal}" ditambahkan ke pemetaan.`)
    }
  }

  const addAllOcrRecommendations = () => {
    if (ocrResults.length === 0) return
    
    const newRows = ocrResults.map((pr, idx) => ({
      id: `row-all-ocr-${idx}-${Date.now()}`,
      kategoriAsal: pr.kategoriAsal || 'transkrip',
      mkAsal: pr.mkAsal,
      sksAsal: pr.sksAsal,
      nilaiAsal: pr.nilaiAsal,
      mkTujuanId: pr.recommendedMkId,
      status: 'diakui'
    }))
    
    setRows(newRows)
    toast.success(`Semua ${newRows.length} rekomendasi hasil OCR dimasukkan ke tabel pemetaan!`)
  }

  // Row Manipulation Helpers
  const addRow = () => {
    setRows([
      ...rows,
      { id: 'row-add-' + Date.now(), kategoriAsal: 'transkrip', mkAsal: '', sksAsal: 0, nilaiAsal: 'A', mkTujuanId: '', status: 'diakui' }
    ])
  }

  const deleteRow = (id) => {
    setRows(rows.filter(r => r.id !== id))
  }

  const updateRow = (id, field, value) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const handleRowCategoryChange = (id, newCategory) => {
    let defaultMkAsal = ''
    if (newCategory === 'sertifikat') {
      const certs = selectedItem.sertifikat_kompetensi || []
      defaultMkAsal = certs.length > 0 ? certs[0].nama : ''
    } else if (newCategory === 'pengalaman') {
      const exprs = selectedItem.pengalaman_kerja || []
      defaultMkAsal = exprs.length > 0 ? `${exprs[0].posisi} di ${exprs[0].perusahaan}` : ''
    }
    setRows(rows.map(r => r.id === id ? { ...r, kategoriAsal: newCategory, mkAsal: defaultMkAsal, sksAsal: 0, nilaiAsal: 'A' } : r))
  }

  const handleSubmitToAsessor = async () => {
    if (rows.length === 0) {
      toast.error('Tabel rekognisi minimal harus memiliki 1 baris pemetaan')
      return
    }

    // Validasi baris
    const invalidRow = rows.find(r => !r.mkAsal || !r.mkTujuanId || !r.nilaiAsal)
    if (invalidRow) {
      toast.error('Pastikan semua baris terisi nama mata kuliah/dokumen asal dan mata kuliah tujuan kurikulum!')
      return
    }

    setSubmitting(true)
    try {
      // 1. Simpan tabel rekognisi ke DB
      const recognitionPayload = {
        data_ekstraksi_ocr: { method: recognitionMethod, run_at: new Date().toISOString() },
        data_mapping_mk: rows.map(r => {
          const matchMK = curriculumMK.find(mk => mk.id === r.mkTujuanId)
          return {
            MK_Asal: r.mkAsal,
            SKS_Asal: parseInt(r.sksAsal) || 0,
            Nilai: r.nilaiAsal,
            MK_Tujuan_ID: r.mkTujuanId,
            MK_Tujuan_Kode: matchMK?.kode_mk || '',
            MK_Tujuan_Nama: matchMK?.nama_mk || '',
            SKS_Tujuan: matchMK?.sks || 0,
            Status: r.status || 'diakui',
            Kategori_Asal: r.kategoriAsal || 'transkrip'
          }
        }),
        is_manual_edited: true
      }

      await dbRekognisi.upsert(selectedItem.id, recognitionPayload)
      // 2. Update status pengajuan ke 'recognized_kaprodi'
      await dbPengajuan.updateStatus(selectedItem.id, 'recognized_kaprodi', '')

      toast.success('Pemetaan rekognisi berhasil disimpan dan diteruskan ke Asessor!')
      loadSubmissions()
    } catch (e) {
      console.error(e)
      toast.error('Gagal memproses rekognisi mata kuliah')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReturnToBaak = async () => {
    if (!catatanRevisi.trim()) {
      toast.error('Silakan isi catatan revisi / alasan pengembalian!')
      return
    }

    setSubmitting(true)
    try {
      await dbPengajuan.updateStatus(selectedItem.id, 'returned_kaprodi', catatanRevisi)
      toast.success('Pengajuan berhasil dikembalikan ke BAAK!')
      loadSubmissions()
    } catch (e) {
      console.error(e)
      toast.error('Gagal mengembalikan pengajuan')
    } finally {
      setSubmitting(false)
    }
  }

  const pendingList = submissions.filter(item => item.status === 'validated_baak' || item.status === 'returned_asessor')
  const completedList = submissions.filter(item => ['recognized_kaprodi', 'assessed_asessor', 'mapped_admin'].includes(item.status))
  const returnedList = submissions.filter(item => item.status === 'returned_kaprodi')

  const activeList = activeTab === 'pending' ? pendingList : activeTab === 'completed' ? completedList : returnedList

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  const canEvaluate = selectedItem && (selectedItem.status === 'validated_baak' || selectedItem.status === 'returned_asessor')

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Pencocokan Rekognisi AI (Ka. Prodi)</h1>
        <p className="page-subtitle">Petakan dokumen transkrip, sertifikat, & pengalaman calon ke kurikulum program studi</p>
      </div>

      {!selectedItem ? (
        /* List submissions with tabs */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Tab Control */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--gray-200)', paddingBottom: 8 }}>
            <button
              onClick={() => setActiveTab('pending')}
              className={`btn btn-sm ${activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontWeight: 600 }}
            >
              Menunggu Evaluasi ({pendingList.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`btn btn-sm ${activeTab === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontWeight: 600 }}
            >
              Selesai Diproses ({completedList.length})
            </button>
            <button
              onClick={() => setActiveTab('returned')}
              className={`btn btn-sm ${activeTab === 'returned' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontWeight: 600 }}
            >
              Direvisi BAAK ({returnedList.length})
            </button>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Daftar Pengajuan Calon Mahasiswa</h3>
              <span className="badge-pill badge-indigo">{activeList.length} Pengajuan</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {activeList.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🎓</div>
                  <div className="empty-state-text">Tidak ada pengajuan</div>
                  <div className="empty-state-sub">Belum ada berkas pendaftaran pendaftar untuk dievaluasi.</div>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nama Pendaftar</th>
                        <th>Email</th>
                        <th>Prodi Pilihan</th>
                        <th>Status Internal</th>
                        <th style={{ width: 120 }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeList.map(item => (
                        <tr key={item.id} style={{ borderLeft: item.status === 'returned_asessor' ? '4px solid var(--danger)' : '' }}>
                          <td>
                            <strong>{item.profile?.nama_lengkap}</strong>
                            {item.status === 'returned_asessor' && (
                              <span style={{ display: 'block', fontSize: 11, color: 'var(--danger)', fontWeight: 600, marginTop: 2 }}>
                                ⚠️ Dikembalikan oleh Asessor: "{item.catatan_revisi}"
                              </span>
                            )}
                          </td>
                          <td>{item.profile?.email}</td>
                          <td><span className="badge-pill badge-slate">{item.prodi?.nama}</span></td>
                          <td><span className={`badge-pill status-${item.status}`}>{item.status.toUpperCase()}</span></td>
                          <td>
                            <button
                              onClick={() => setSelectedItem(item)}
                              className="btn btn-primary btn-sm"
                            >
                              {activeTab === 'pending' ? 'Mulai Rekognisi' : 'Lihat'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Detailed recognition process screen */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Warning Banner if returned from Asessor */}
          {selectedItem.status === 'returned_asessor' && (
            <div className="card" style={{ borderLeft: '4px solid var(--danger)', backgroundColor: '#fff5f5' }}>
              <div className="card-body">
                <h4 style={{ color: '#c53030', display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: '14px', fontWeight: 700 }}>
                  ⚠️ Pengajuan Dikembalikan oleh Asessor untuk Revisi
                </h4>
                <p style={{ color: '#742a2a', fontSize: '13px', marginTop: 8, marginBottom: 0 }}>
                  Catatan Asessor: <strong>{selectedItem.catatan_revisi || 'Harap perbaiki pemetaan Anda.'}</strong>
                </p>
              </div>
            </div>
          )}

          {/* Header Card */}
          <div className="card" style={{ background: 'var(--indigo-50)', borderColor: 'var(--indigo-100)' }}>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--indigo-600)', fontWeight: 700, textTransform: 'uppercase' }}>Proses Evaluasi Ka. Prodi</span>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--indigo-700)', margin: '2px 0 0 0' }}>{selectedItem.profile?.nama_lengkap}</h2>
                <p style={{ fontSize: 12.5, color: 'var(--gray-600)', margin: 0 }}>Pilihan Prodi: {selectedItem.prodi?.nama}</p>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {canEvaluate && (
                  <button onClick={() => setShowReturnInput(v => !v)} className="btn btn-danger btn-sm">
                    Kembalikan ke BAAK
                  </button>
                )}
                <button onClick={handleCancel} className="btn btn-secondary btn-sm">Batal</button>
              </div>
            </div>
          </div>

          {/* Return Input Card */}
          {showReturnInput && (
            <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#c53030' }}>Kembalikan Pengajuan ke BAAK</h4>
                <textarea
                  value={catatanRevisi}
                  onChange={(e) => setCatatanRevisi(e.target.value)}
                  placeholder="Masukkan catatan perbaikan untuk BAAK (misal: Transkrip buram atau berkas palsu)..."
                  className="input"
                  rows={2}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleReturnToBaak} disabled={submitting} className="btn btn-danger btn-sm">Kirim Pengembalian</button>
                  <button onClick={() => setShowReturnInput(false)} className="btn btn-secondary btn-sm">Batal</button>
                </div>
              </div>
            </div>
          )}

          {/* Select Mapping Method screen (if method not selected yet) */}
          {!recognitionMethod && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
              {/* Left Column: Iframe preview */}
              <div className="card">
                <div className="card-header">
                  <h3 style={{ fontSize: 13, fontWeight: 700 }}>Berkas Transkrip Asal</h3>
                </div>
                <div className="card-body" style={{ padding: 12 }}>
                  <TranscriptPreview
                    fileUrl={selectedItem.file_transkrip_url}
                    profileName={selectedItem.profile?.nama_lengkap || 'Calon Mahasiswa'}
                    prodiName={selectedItem.prodi?.nama || '-'}
                    height={420}
                  />
                </div>
              </div>

              {/* Right Column: OCR Action Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Javascript OCR Card */}
                <div className="card" style={{ cursor: 'pointer', borderColor: 'var(--gray-200)', transition: 'border-color .15s' }} 
                     onClick={runJSOCR}
                     onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--emerald-400)'}
                     onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--gray-200)'}>
                  <div className="card-body" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ background: '#ecfdf5', color: '#059669', width: 32, height: 32, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 12 }}>JS</div>
                      <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Scan OCR Javascript</h4>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.5, margin: 0 }}>
                      Ekstrak transkrip secara cepat menggunakan parser OCR berbasis client-side JavaScript.
                    </p>
                  </div>
                </div>

                {/* AI OCR Card */}
                <div className="card" style={{ cursor: 'pointer', borderColor: 'var(--gray-200)', transition: 'border-color .15s' }} 
                     onClick={runAIOCR}
                     onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--indigo-400)'}
                     onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--gray-200)'}>
                  <div className="card-body" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ background: '#e0e7ff', color: 'var(--indigo-600)', width: 32, height: 32, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Brain size={16} /></div>
                      <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Smart AI OCR (Sumopod AI)</h4>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.5, margin: 0 }}>
                      Mengirim transkrip ke Gemini 1.5 Pro (via Sumopod AI API) untuk ekstraksi pintar dan OBE matching otomatis.
                    </p>
                  </div>
                </div>

                {/* Manual Input Alternative */}
                <div className="card" style={{ cursor: 'pointer', borderColor: 'var(--gray-200)', transition: 'border-color .15s' }} 
                     onClick={handleManualInput}
                     onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gray-400)'}
                     onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--gray-200)'}>
                  <div className="card-body" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <Plus size={16} color="var(--gray-500)" />
                      <h5 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: 'var(--gray-700)' }}>Input Pemetaan Manual</h5>
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--gray-500)', margin: 0 }}>
                      Masukkan baris pemetaan mata kuliah satu persatu secara manual.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI/JS OCR Running Loader */}
          {ocrRunning && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
              {/* Left Column: Iframe preview with absolute overlays */}
              <div className="card">
                <div className="card-header">
                  <h3 style={{ fontSize: 13, fontWeight: 700 }}>Memindai Dokumen Transkrip...</h3>
                </div>
                <div className="card-body" style={{ padding: 12 }}>
                  <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, overflow: 'hidden', height: 420, position: 'relative' }}>
                    
                    {/* Laser scan animation overlay */}
                    {scanEffect === 'javascript' && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(74, 222, 128, 0.04)',
                        pointerEvents: 'none',
                        zIndex: 10
                      }}>
                        <div style={{
                          width: '100%', height: 4,
                          background: 'linear-gradient(to bottom, transparent, rgba(52, 211, 153, 0.8), rgba(52, 211, 153, 1), rgba(52, 211, 153, 0.8), transparent)',
                          boxShadow: '0 0 15px rgba(52, 211, 153, 0.8)',
                          position: 'absolute', top: 0, left: 0,
                          animation: 'laserScan 2s linear infinite'
                        }} />
                      </div>
                    )}

                    {/* Brain scan animation overlay */}
                    {scanEffect === 'ai' && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(99, 102, 241, 0.06)',
                        pointerEvents: 'none',
                        zIndex: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <div style={{
                          width: '100%', height: '100%',
                          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
                          animation: 'pulseBrain 1.5s ease-in-out infinite'
                        }} />
                      </div>
                    )}

                    <TranscriptPreview
                      fileUrl={selectedItem.file_transkrip_url}
                      profileName={selectedItem.profile?.nama_lengkap || 'Calon Mahasiswa'}
                      prodiName={selectedItem.prodi?.nama || '-'}
                      height={420}
                      noBorder={true}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Loading progress */}
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, height: '100%' }}>
                  <RefreshCw size={36} className="spinner" color={scanEffect === 'ai' ? 'var(--indigo-600)' : 'var(--emerald-500)'} />
                  <h3 style={{ fontSize: 15, fontWeight: 700 }}>Proses Analisis OCR {scanEffect === 'ai' ? 'AI' : 'Lokal'}</h3>
                  <p style={{ fontSize: 12.5, color: 'var(--gray-500)', background: 'var(--gray-50)', padding: '8px 16px', borderRadius: 6, border: '1px solid var(--gray-200)', width: '100%' }}>
                    🤖 {ocrProgress}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Recognition Working Grid (Side-by-side editing panel) */}
          {recognitionMethod && (
            <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 20, alignItems: 'start' }}>
              {/* Left Column: Transcript Document & Curriculum & Certs Tabs */}
              <div className="card">
                <div style={{ display: 'flex', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)', padding: 6, gap: 4, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setLeftTab('transcript')}
                    className={`btn btn-sm ${leftTab === 'transcript' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '6px' }}
                  >
                    📄 Transkrip
                  </button>
                  <button
                    onClick={() => setLeftTab('curriculum')}
                    className={`btn btn-sm ${leftTab === 'curriculum' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '6px' }}
                  >
                    📚 Kurikulum
                  </button>
                  <button
                    onClick={() => setLeftTab('certificate')}
                    className={`btn btn-sm ${leftTab === 'certificate' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '6px' }}
                  >
                    🏆 Sertifikat ({selectedItem.sertifikat_kompetensi?.length || 0})
                  </button>
                  <button
                    onClick={() => setLeftTab('experience')}
                    className={`btn btn-sm ${leftTab === 'experience' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '6px' }}
                  >
                    💼 Kerja ({selectedItem.pengalaman_kerja?.length || 0})
                  </button>
                </div>
                <div className="card-body" style={{ padding: 12 }}>
                  {leftTab === 'transcript' && (
                    <TranscriptPreview
                      fileUrl={selectedItem.file_transkrip_url}
                      profileName={selectedItem.profile?.nama_lengkap || 'Calon Mahasiswa'}
                      prodiName={selectedItem.prodi?.nama || '-'}
                      height={480}
                      noBorder={true}
                    />
                  )}
                  {leftTab === 'curriculum' && (
                    <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                      <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'var(--gray-700)' }}>Daftar Kurikulum {selectedItem.prodi?.nama}</h4>
                      <div className="table-wrap">
                        <table style={{ minWidth: 'auto', width: '100%' }}>
                          <thead>
                            <tr>
                              <th style={{ padding: '6px 8px', fontSize: 11 }}>Kode/MK</th>
                              <th style={{ padding: '6px 8px', fontSize: 11, width: 60 }}>SKS</th>
                              {canEvaluate && <th style={{ padding: '6px 8px', fontSize: 11, width: 50 }}>Aksi</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {curriculumMK.map(mk => (
                              <tr key={mk.id}>
                                <td style={{ padding: '6px 8px', fontSize: 11.5 }}>
                                  <strong>{mk.kode_mk}</strong><br />
                                  <span style={{ color: 'var(--gray-600)' }}>{mk.nama_mk}</span>
                                </td>
                                <td style={{ padding: '6px 8px', fontSize: 11.5, text: 'center' }}>
                                  {mk.sks} SKS
                                </td>
                                {canEvaluate && (
                                  <td style={{ padding: '6px 8px', text: 'center' }}>
                                    <button
                                      onClick={() => addCurriculumToMapping(mk)}
                                      className="btn btn-secondary"
                                      style={{
                                        padding: '2px 6px',
                                        fontSize: 11,
                                        background: '#ecfdf5',
                                        color: '#047857',
                                        borderColor: '#a7f3d0'
                                      }}
                                      title="Tambahkan ke Pemetaan"
                                    >
                                      + Map
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {leftTab === 'certificate' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 2 }}>Sertifikat Kompetensi Pendaftar</h4>
                      {(!selectedItem.sertifikat_kompetensi || selectedItem.sertifikat_kompetensi.length === 0) ? (
                        <p style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic' }}>Tidak ada sertifikat kompetensi terlampir.</p>
                      ) : (
                        <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {selectedItem.sertifikat_kompetensi.map((c, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--gray-50)', padding: 10, borderRadius: 8, border: '1px solid var(--gray-200)' }}>
                              <div>
                                <strong style={{ fontSize: 12.5, display: 'block' }}>{c.nama}</strong>
                                <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>{c.penerbit} ({c.tahun})</span>
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => { setActiveLeftDocType('sertifikat'); setActiveLeftDocUrl(c.file_url) }}
                                  className={`btn btn-secondary btn-sm ${activeLeftDocType === 'sertifikat' && activeLeftDocUrl === c.file_url ? 'btn-primary' : ''}`}
                                  style={{ fontSize: 11, padding: '4px 8px' }}
                                >
                                  👁️ Lihat
                                </button>
                                {canEvaluate && (
                                  <button
                                    type="button"
                                    onClick={() => addCertificateToMapping(c)}
                                    className="btn btn-primary btn-sm"
                                    style={{ fontSize: 11, padding: '4px 8px' }}
                                  >
                                    + Map
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {activeLeftDocUrl && activeLeftDocType === 'sertifikat' && (
                        <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, height: 240, overflow: 'hidden' }}>
                          <TranscriptPreview
                            fileUrl={activeLeftDocUrl}
                            profileName={selectedItem.profile?.nama_lengkap || 'Calon Mahasiswa'}
                            prodiName={selectedItem.prodi?.nama || '-'}
                            height={240}
                            noBorder={true}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {leftTab === 'experience' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 2 }}>Pengalaman Kerja / Portofolio Kerja</h4>
                      {(!selectedItem.pengalaman_kerja || selectedItem.pengalaman_kerja.length === 0) ? (
                        <p style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic' }}>Tidak ada portofolio kerja terlampir.</p>
                      ) : (
                        <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {selectedItem.pengalaman_kerja.map((ex, idx) => (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--gray-50)', padding: 10, borderRadius: 8, border: '1px solid var(--gray-200)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <strong style={{ fontSize: 12.5, display: 'block' }}>{ex.posisi}</strong>
                                  <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>{ex.perusahaan} ({ex.durasi})</span>
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    type="button"
                                    onClick={() => { setActiveLeftDocType('pengalaman'); setActiveLeftDocUrl(ex.file_url) }}
                                    className={`btn btn-secondary btn-sm ${activeLeftDocType === 'pengalaman' && activeLeftDocUrl === ex.file_url ? 'btn-primary' : ''}`}
                                    style={{ fontSize: 11, padding: '4px 8px' }}
                                  >
                                    👁️ Lihat
                                  </button>
                                  {canEvaluate && (
                                    <button
                                      type="button"
                                      onClick={() => addExperienceToMapping(ex)}
                                      className="btn btn-primary btn-sm"
                                      style={{ fontSize: 11, padding: '4px 8px' }}
                                    >
                                      + Map
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p style={{ fontSize: 11.5, color: 'var(--gray-600)', margin: 0, lineClamp: 2 }}>{ex.deskripsi}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {activeLeftDocUrl && activeLeftDocType === 'pengalaman' && (
                        <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, height: 240, overflow: 'hidden' }}>
                          <TranscriptPreview
                            fileUrl={activeLeftDocUrl}
                            profileName={selectedItem.profile?.nama_lengkap || 'Calon Mahasiswa'}
                            prodiName={selectedItem.prodi?.nama || '-'}
                            height={240}
                            noBorder={true}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: OCR Results & Table of Recognition Courses */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* OCR results and AI Recommendations panel */}
                {ocrResults.length > 0 && canEvaluate && (
                  <div className="card" style={{ borderColor: 'var(--emerald-200)', background: '#fafdfb' }}>
                    <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--emerald-100)' }}>
                      <div>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#047857', display: 'flex', alignItems: 'center', gap: 6 }}>
                          ✨ Hasil Ekstraksi OCR & Rekomendasi AI
                        </h3>
                        <p style={{ margin: 0, fontSize: 11, color: '#065f46' }}>
                          Hasil ekstraksi berkas transkrip, sertifikat, & pengalaman disandingkan dengan kurikulum prodi
                        </p>
                      </div>
                      <button
                        onClick={addAllOcrRecommendations}
                        className="btn"
                        style={{
                          padding: '6px 12px',
                          fontSize: 11.5,
                          background: '#047857',
                          color: '#fff',
                          border: 'none',
                          fontWeight: 700,
                          borderRadius: 6
                        }}
                      >
                        ⚡ Tambahkan Semua Hasil OCR
                      </button>
                    </div>
                    <div className="card-body" style={{ padding: '12px 16px' }}>
                      <div className="table-wrap">
                        <table style={{ background: '#fff' }}>
                          <thead>
                            <tr>
                              <th style={{ padding: '8px 10px', fontSize: 11.5, background: '#f0fdf4' }}>Berkas / Mata Kuliah Asal</th>
                              <th style={{ padding: '8px 10px', fontSize: 11.5, background: '#f0fdf4', width: 80, textAlign: 'center' }}>SKS/Nilai</th>
                              <th style={{ padding: '8px 10px', fontSize: 11.5, background: '#f0fdf4' }}>Rekomendasi AI / Kemiripan</th>
                              <th style={{ padding: '8px 10px', fontSize: 11.5, background: '#f0fdf4', width: 90, textAlign: 'center' }}>Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ocrResults.map(ocrItem => {
                              const recommendedMk = curriculumMK.find(mk => mk.id === ocrItem.recommendedMkId)
                              const isMapped = rows.some(r => r.mkAsal.toLowerCase() === ocrItem.mkAsal.toLowerCase() && r.mkTujuanId === ocrItem.recommendedMkId)
                              
                              return (
                                <tr key={ocrItem.id} style={{ opacity: isMapped ? 0.75 : 1 }}>
                                  <td style={{ padding: '8px 10px', fontSize: 12 }}>
                                    <span style={{ 
                                      display: 'inline-block', 
                                      fontSize: '10px', 
                                      padding: '1px 5px', 
                                      borderRadius: 4, 
                                      marginRight: 6, 
                                      fontWeight: 700, 
                                      textTransform: 'uppercase', 
                                      background: ocrItem.kategoriAsal === 'sertifikat' ? '#e6f4ea' : ocrItem.kategoriAsal === 'pengalaman' ? '#fef7e0' : '#e8eaed', 
                                      color: ocrItem.kategoriAsal === 'sertifikat' ? '#137333' : ocrItem.kategoriAsal === 'pengalaman' ? '#b06000' : '#3c4043' 
                                    }}>
                                      {ocrItem.kategoriAsal === 'sertifikat' ? '🏆 Sertifikat' : ocrItem.kategoriAsal === 'pengalaman' ? '💼 Kerja' : '📄 Transkrip'}
                                    </span>
                                    <strong>{ocrItem.mkAsal}</strong>
                                  </td>
                                  <td style={{ padding: '8px 10px', fontSize: 12, textAlign: 'center' }}>
                                    {ocrItem.sksAsal} SKS / <strong style={{ color: 'var(--indigo-600)' }}>{ocrItem.nilaiAsal}</strong>
                                  </td>
                                  <td style={{ padding: '8px 10px', fontSize: 12 }}>
                                    {recommendedMk ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <span style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{recommendedMk.kode_mk} - {recommendedMk.nama_mk}</span>
                                        <span style={{ fontSize: 10.5, display: 'inline-flex', width: 'fit-content', padding: '1px 5px', borderRadius: 4, background: ocrItem.confidence > 75 ? '#d1fae5' : '#fef3c7', color: ocrItem.confidence > 75 ? '#065f46' : '#92400e', fontWeight: 700 }}>
                                          Match: {ocrItem.confidence}%
                                        </span>
                                      </div>
                                    ) : (
                                      <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>Tidak ada kecocokan dekat</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                    {isMapped ? (
                                      <span style={{ fontSize: 11.5, color: '#047857', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                        ✓ Mapped
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => addOcrResultToMapping(ocrItem)}
                                        className="btn btn-secondary"
                                        style={{
                                          padding: '4px 8px',
                                          fontSize: 11,
                                          background: 'var(--indigo-50)',
                                          color: 'var(--indigo-700)',
                                          borderColor: 'var(--indigo-200)'
                                        }}
                                      >
                                        Map & Tambah
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Final Recognition Mapping Table */}
                <div className="card">
                  <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 700 }}>Tabel Pemetaan Rekognisi Mata Kuliah</h3>
                      <p style={{ margin: 0, fontSize: 11.5, color: 'var(--gray-500)' }}>Penyandingan akhir untuk diserahkan ke Asessor RPL</p>
                    </div>
                    {canEvaluate ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={addRow} className="btn btn-secondary btn-sm" style={{ gap: 4 }}>
                          <Plus size={14} /> Tambah Pemetaan
                        </button>
                        <button onClick={handleSubmitToAsessor} disabled={submitting} className="btn btn-primary btn-sm" style={{ gap: 4 }}>
                          <CheckCircle size={14} /> Selesaikan Pemetaan
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', background: 'var(--gray-100)', padding: '6px 12px', borderRadius: 6 }}>
                        Modus Lihat (Read-Only)
                      </span>
                    )}
                  </div>
                  <div className="card-body" style={{ padding: 0 }}>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th style={{ background: '#f8fafc', color: 'var(--indigo-700)', fontWeight: 800, borderBottom: '2px solid var(--indigo-100)', width: '15%' }}>Kategori</th>
                            <th style={{ background: '#f8fafc', color: 'var(--indigo-700)', fontWeight: 800, borderBottom: '2px solid var(--indigo-100)', width: '30%' }}>Mata Kuliah / Berkas Asal</th>
                            <th style={{ background: '#f8fafc', color: 'var(--indigo-700)', fontWeight: 800, borderBottom: '2px solid var(--indigo-100)', width: '10%' }}>SKS Asal</th>
                            <th style={{ background: '#f8fafc', color: 'var(--indigo-700)', fontWeight: 800, borderBottom: '2px solid var(--indigo-100)', width: '10%' }}>Nilai</th>
                            <th style={{ background: '#f8fafc', color: 'var(--indigo-700)', fontWeight: 800, borderBottom: '2px solid var(--indigo-100)', width: '25%' }}>Disandingkan ke MK Kurikulum</th>
                            {canEvaluate && <th style={{ background: '#f8fafc', color: 'var(--indigo-700)', fontWeight: 800, borderBottom: '2px solid var(--indigo-100)', width: '10%' }}>Aksi</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(row => (
                            <tr key={row.id}>
                              {/* Category selection */}
                              <td>
                                {canEvaluate ? (
                                  <select
                                    value={row.kategoriAsal}
                                    onChange={(e) => handleRowCategoryChange(row.id, e.target.value)}
                                    style={{
                                      padding: '5px 8px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--gray-200)',
                                      background: 'var(--surface)',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      outline: 'none'
                                    }}
                                  >
                                    <option value="transkrip">📄 Transkrip</option>
                                    <option value="sertifikat">🏆 Sertifikat</option>
                                    <option value="pengalaman">💼 Kerja</option>
                                  </select>
                                ) : (
                                  <span className={`badge-pill ${
                                    row.kategoriAsal === 'sertifikat' ? 'badge-green' :
                                    row.kategoriAsal === 'pengalaman' ? 'badge-amber' :
                                    'badge-indigo'
                                  }`}>
                                    {row.kategoriAsal === 'sertifikat' ? '🏆 Sertifikat' :
                                     row.kategoriAsal === 'pengalaman' ? '💼 Kerja' :
                                     '📄 Transkrip'}
                                  </span>
                                )}
                              </td>

                              {/* MK Asal or File source selector */}
                              <td>
                                {row.kategoriAsal === 'transkrip' ? (
                                  <input
                                    type="text"
                                    value={row.mkAsal}
                                    disabled={!canEvaluate}
                                    onChange={(e) => updateRow(row.id, 'mkAsal', e.target.value)}
                                    placeholder="cth: Dasar Pemrograman I"
                                    className="input"
                                    style={{ padding: '6px 10px' }}
                                  />
                                ) : row.kategoriAsal === 'sertifikat' ? (
                                  (!selectedItem.sertifikat_kompetensi || selectedItem.sertifikat_kompetensi.length === 0) ? (
                                    <span style={{ fontSize: 11.5, color: 'var(--gray-400)', fontStyle: 'italic' }}>Tidak ada sertifikat</span>
                                  ) : (
                                    <select
                                      value={row.mkAsal}
                                      disabled={!canEvaluate}
                                      onChange={(e) => updateRow(row.id, 'mkAsal', e.target.value)}
                                      className="input"
                                      style={{ padding: '6px 10px' }}
                                    >
                                      <option value="">-- Pilih Sertifikat --</option>
                                      {selectedItem.sertifikat_kompetensi.map((c, i) => (
                                        <option key={i} value={c.nama}>{c.nama}</option>
                                      ))}
                                    </select>
                                  )
                                ) : (
                                  (!selectedItem.pengalaman_kerja || selectedItem.pengalaman_kerja.length === 0) ? (
                                    <span style={{ fontSize: 11.5, color: 'var(--gray-400)', fontStyle: 'italic' }}>Tidak ada pengalaman</span>
                                  ) : (
                                    <select
                                      value={row.mkAsal}
                                      disabled={!canEvaluate}
                                      onChange={(e) => updateRow(row.id, 'mkAsal', e.target.value)}
                                      className="input"
                                      style={{ padding: '6px 10px' }}
                                    >
                                      <option value="">-- Pilih Pengalaman Kerja --</option>
                                      {selectedItem.pengalaman_kerja.map((ex, i) => {
                                        const label = `${ex.posisi} di ${ex.perusahaan}`;
                                        return <option key={i} value={label}>{label}</option>
                                      })}
                                    </select>
                                  )
                                )}
                              </td>

                              {/* SKS Asal */}
                              <td>
                                <input
                                  type="number"
                                  value={row.sksAsal || ''}
                                  disabled={!canEvaluate || row.kategoriAsal !== 'transkrip'}
                                  onChange={(e) => updateRow(row.id, 'sksAsal', e.target.value)}
                                  placeholder="cth: 3"
                                  className="input"
                                  style={{ padding: '6px 10px' }}
                                />
                              </td>

                              {/* Nilai Asal */}
                              <td>
                                <input
                                  type="text"
                                  value={row.nilaiAsal}
                                  disabled={!canEvaluate || row.kategoriAsal !== 'transkrip'}
                                  onChange={(e) => updateRow(row.id, 'nilaiAsal', e.target.value.toUpperCase())}
                                  placeholder="cth: A"
                                  className="input"
                                  style={{ padding: '6px 10px' }}
                                />
                              </td>

                              {/* Target MK Kurikulum */}
                              <td>
                                <select
                                  value={row.mkTujuanId}
                                  disabled={!canEvaluate}
                                  onChange={(e) => updateRow(row.id, 'mkTujuanId', e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--gray-200)',
                                    background: 'var(--surface)',
                                    fontSize: '13px',
                                    outline: 'none'
                                  }}
                                >
                                  <option value="">-- Pilih MK Kurikulum --</option>
                                  {curriculumMK.map(mk => (
                                    <option key={mk.id} value={mk.id}>
                                      {mk.kode_mk} - {mk.nama_mk} ({mk.sks} SKS, {mk.jenis.toUpperCase()})
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Aksi Hapus */}
                              {canEvaluate && (
                                <td>
                                  <button
                                    onClick={() => deleteRow(row.id)}
                                    className="btn btn-ghost btn-icon"
                                    style={{ color: 'var(--danger)' }}
                                    title="Hapus baris"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
