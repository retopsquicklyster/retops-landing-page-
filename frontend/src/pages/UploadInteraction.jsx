import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { api, API } from "../lib/api";
import { Upload as UploadIcon, Loader2, Sparkles, FileText, Mic, Square } from "lucide-react";
import { toast } from "sonner";

const SAMPLES = [
  {
    label: "Billing complaint (high churn risk)",
    customer: "Acme Corp",
    agent: "Alex Rodriguez",
    agent_type: "Human",
    channel: "Voice",
    type: "Billing",
    transcript: "Customer: Third call this month about the same charge — I'm looking at competitors.\nAgent: Our refund policy is 14 days, so I can't refund this.\nCustomer: That's not what your other rep told me. I need this escalated now.",
  },
  {
    label: "AI hallucination",
    customer: "Summit Logistics",
    agent: "Support Bot v3",
    agent_type: "AI",
    channel: "Chat",
    type: "Billing",
    transcript: "Customer: Does my plan include unlimited international calls?\nAgent: Yes, your subscription includes unlimited data and unlimited international calls on all plans.",
  },
  {
    label: "Upsell opportunity",
    customer: "NovaTech Ltd.",
    agent: "Emma Davis",
    agent_type: "Human",
    channel: "Chat",
    type: "Upsell",
    transcript: "Customer: We're adding two more offices next quarter, want to make sure we're on the right plan.\nAgent: Great — the Scale tier is a better fit, I'll loop in your AM.",
  },
];

export default function UploadInteraction() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    customer: "", agent: "", agent_type: "Human", channel: "Voice", type: "General", transcript: "", duration_sec: 0,
  });
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState("text");

  // File upload state
  const fileInputRef = useRef(null);
  const [uploadedFile, setUploadedFile] = useState(null);

  // Audio recording state
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const pickMethod = (id) => {
    setMethod(id);
    if (id === "audio") toast.info("Click the red mic to start recording. Whisper will transcribe when you stop.");
    if (id === "file") toast.info("Drop .txt, .md, .docx, .csv, or .pdf — RetOps parses and scores it.");
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) { toast.error("File too large (max 25MB)"); return; }
    setUploadedFile(f);
  };

  const submitFile = async () => {
    if (!uploadedFile) { toast.error("Choose a file first"); return; }
    if (!form.customer || !form.agent) { toast.error("Customer and agent are required"); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadedFile);
      fd.append("customer", form.customer);
      fd.append("agent", form.agent);
      fd.append("agent_type", form.agent_type);
      fd.append("channel", form.channel);
      fd.append("type", form.type);
      const r = await api.post("/interactions/upload-file", fd);
      toast.success("Scored! Opening analysis…");
      navigate(`/dashboard/interactions/${r.data.interaction_id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "File upload failed");
    } finally { setLoading(false); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (e) {
      toast.error("Microphone blocked. Grant permission and retry.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const submitAudio = async () => {
    if (!audioBlob) { toast.error("Record something first"); return; }
    if (!form.customer || !form.agent) { toast.error("Customer and agent are required"); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", audioBlob, "recording.webm");
      fd.append("customer", form.customer);
      fd.append("agent", form.agent);
      fd.append("agent_type", form.agent_type);
      fd.append("channel", "Voice");
      const r = await api.post("/interactions/upload-audio", fd);
      toast.success("Transcribed & scored! Opening analysis…");
      navigate(`/dashboard/interactions/${r.data.interaction_id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Audio transcription failed");
    } finally { setLoading(false); }
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const loadSample = (s) => setForm({ ...form, ...s });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.customer || !form.agent || !form.transcript) {
      toast.error("Customer, agent, and transcript are required");
      return;
    }
    setLoading(true);
    try {
      const r = await api.post("/interactions", form);
      toast.success("Scored! Opening analysis…");
      navigate(`/dashboard/interactions/${r.data.interaction_id}`);
    } catch (err) {
      toast.error("Scoring failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Upload Interaction" subtitle="Drop in a transcript — RetOps will score it, detect churn risk, and produce a coaching card.">
      {/* Choose Upload Method */}
      <div className="ret-card p-6 mb-5" data-testid="upload-method-picker">
        <h3 className="font-display text-lg font-semibold mb-4">Choose Upload Method</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { id: "file",  icon: UploadIcon, title: "File Upload",    sub: "Upload audio or transcript files" },
            { id: "text",  icon: FileText,   title: "Text Input",     sub: "Paste transcript directly" },
            { id: "audio", icon: Mic,        title: "Audio Recording", sub: "Record live interaction" },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              data-testid={`method-${m.id}`}
              onClick={() => pickMethod(m.id)}
              className={`p-6 rounded-xl border-2 text-center transition-all ${method === m.id ? "border-[hsl(var(--retops-teal))] bg-[hsl(var(--retops-teal-2))]/40" : "border-[hsl(var(--line))] hover:border-[hsl(var(--brand-200))] bg-white"}`}
            >
              <m.icon className={`w-6 h-6 mx-auto mb-3 ${method === m.id ? "text-[hsl(var(--retops-teal))]" : "text-[hsl(var(--ink-2))]"}`} />
              <p className="font-semibold text-sm">{m.title}</p>
              <p className="text-xs text-[hsl(var(--ink-3))] mt-1">{m.sub}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr,1fr] gap-5">
        {method === "file" && (
          <div className="ret-card p-6" data-testid="file-upload-panel">
            <h3 className="font-display text-lg font-semibold">File Upload</h3>
            <p className="text-sm text-[hsl(var(--ink-2))] mt-1">Drop a transcript file — RetOps parses .txt, .md, .csv, .docx, or .pdf and scores the content.</p>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Field label="Customer / Account"><input data-testid="file-customer" value={form.customer} onChange={(e) => set("customer", e.target.value)} className="input" placeholder="Acme Corp" /></Field>
              <Field label="Agent"><input data-testid="file-agent" value={form.agent} onChange={(e) => set("agent", e.target.value)} className="input" placeholder="Alex Rodriguez" /></Field>
              <Field label="Agent type">
                <select data-testid="file-agent-type" value={form.agent_type} onChange={(e) => set("agent_type", e.target.value)} className="input"><option>Human</option><option>AI</option></select>
              </Field>
              <Field label="Channel">
                <select data-testid="file-channel" value={form.channel} onChange={(e) => set("channel", e.target.value)} className="input"><option>Email</option><option>Chat</option><option>Ticket</option><option>Voice</option></select>
              </Field>
            </div>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) { setUploadedFile(f); } }}
              className="mt-4 p-8 border-2 border-dashed border-[hsl(var(--line))] hover:border-[hsl(var(--retops-teal))] rounded-2xl text-center cursor-pointer transition-colors"
              data-testid="file-dropzone"
            >
              <UploadIcon className="w-8 h-8 mx-auto text-[hsl(var(--ink-3))]" />
              <p className="mt-3 text-sm font-semibold"><span className="text-[hsl(var(--retops-teal))]">Click to upload</span> or drag and drop</p>
              <p className="text-xs text-[hsl(var(--ink-3))] mt-1">Audio files (MP3, WAV, WEBM) or text files (TXT, DOCX, CSV, PDF, MD) up to 25MB</p>
              {uploadedFile && <p className="mt-3 text-sm font-semibold text-[hsl(var(--retops-teal))]" data-testid="file-chosen">✓ {uploadedFile.name} · {(uploadedFile.size/1024).toFixed(1)} KB</p>}
              <input ref={fileInputRef} type="file" accept=".txt,.md,.csv,.docx,.pdf,.mp3,.wav,.webm,.m4a,.mp4" className="hidden" onChange={handleFileChange} data-testid="file-input" />
            </div>
            <button onClick={submitFile} disabled={loading || !uploadedFile} className="btn-primary mt-5 flex items-center gap-2" data-testid="file-submit-btn">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? "Scoring…" : "Upload & Analyze"}
            </button>
          </div>
        )}

        {method === "audio" && (
          <div className="ret-card p-6" data-testid="audio-recorder-panel">
            <h3 className="font-display text-lg font-semibold">Audio Recording</h3>
            <p className="text-sm text-[hsl(var(--ink-2))] mt-1">Record a live interaction. RetOps transcription will produce a transcript, then score it against your rubric.</p>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Field label="Customer / Account"><input data-testid="audio-customer" value={form.customer} onChange={(e) => set("customer", e.target.value)} className="input" placeholder="Acme Corp" /></Field>
              <Field label="Agent"><input data-testid="audio-agent" value={form.agent} onChange={(e) => set("agent", e.target.value)} className="input" placeholder="Alex Rodriguez" /></Field>
            </div>
            <div className="mt-6 flex flex-col items-center justify-center p-8 rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--bg-subtle))]">
              {!recording ? (
                <button onClick={startRecording} data-testid="audio-start-btn" className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 text-white grid place-items-center shadow-lg transition-transform hover:scale-105">
                  <Mic className="w-8 h-8" />
                </button>
              ) : (
                <button onClick={stopRecording} data-testid="audio-stop-btn" className="w-20 h-20 rounded-full bg-red-500 text-white grid place-items-center shadow-lg animate-pulse">
                  <Square className="w-8 h-8 fill-white" />
                </button>
              )}
              <p className="mt-4 text-sm font-semibold">{recording ? "Recording… click square to stop" : audioBlob ? "Recording captured" : "Click mic to start recording"}</p>
              {audioBlob && <audio src={URL.createObjectURL(audioBlob)} controls className="mt-3 w-full max-w-xs" data-testid="audio-preview" />}
            </div>
            <button onClick={submitAudio} disabled={loading || !audioBlob} className="btn-primary mt-5 flex items-center gap-2" data-testid="audio-submit-btn">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? "Transcribing & scoring…" : "Transcribe & Analyze"}
            </button>
          </div>
        )}

        {method === "text" && (
        <form onSubmit={submit} className="ret-card p-6" data-testid="upload-form">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Customer / Account">
              <input data-testid="in-customer" value={form.customer} onChange={(e) => set("customer", e.target.value)} className="input" placeholder="Acme Corp" />
            </Field>
            <Field label="Agent">
              <input data-testid="in-agent" value={form.agent} onChange={(e) => set("agent", e.target.value)} className="input" placeholder="Alex Rodriguez" />
            </Field>
            <Field label="Agent type">
              <select data-testid="in-agent-type" value={form.agent_type} onChange={(e) => set("agent_type", e.target.value)} className="input">
                <option>Human</option><option>AI</option>
              </select>
            </Field>
            <Field label="Channel">
              <select data-testid="in-channel" value={form.channel} onChange={(e) => set("channel", e.target.value)} className="input">
                <option>Voice</option><option>Chat</option><option>Email</option><option>Ticket</option>
              </select>
            </Field>
            <Field label="Interaction type">
              <input data-testid="in-type" value={form.type} onChange={(e) => set("type", e.target.value)} className="input" placeholder="Billing / Technical / Renewal" />
            </Field>
            <Field label="Duration (seconds)">
              <input data-testid="in-duration" type="number" value={form.duration_sec} onChange={(e) => set("duration_sec", parseInt(e.target.value || "0", 10))} className="input" />
            </Field>
          </div>
          <Field label="Transcript" className="mt-4">
            <textarea data-testid="in-transcript" value={form.transcript} onChange={(e) => set("transcript", e.target.value)} rows={12} className="input font-code text-xs leading-relaxed" placeholder="Paste or type the interaction transcript here…" />
          </Field>
          <button data-testid="score-btn" disabled={loading} type="submit" className="btn-primary mt-5 flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? "Scoring with LLM…" : "Score this interaction"}
          </button>
        </form>
        )}

        <div className="space-y-4">
          <div className="ret-card p-6">
            <h3 className="font-display text-lg font-semibold flex items-center gap-2">
              <UploadIcon className="w-4 h-4 text-[hsl(var(--brand))]" /> Load a sample
            </h3>
            <p className="text-sm text-[hsl(var(--ink-2))] mt-1">
              Try one of the preset scenarios to see RetOps score human and AI interactions in real time.
            </p>
            <div className="mt-4 space-y-2">
              {SAMPLES.map((s, i) => (
                <button key={i} data-testid={`sample-${i}`} onClick={() => loadSample(s)} className="w-full text-left p-3 border border-[hsl(var(--line))] rounded-xl hover:border-[hsl(var(--brand-200))] hover:bg-[hsl(var(--bg-subtle))] transition-colors">
                  <p className="text-sm font-semibold">{s.label}</p>
                  <p className="text-xs text-[hsl(var(--ink-3))] mt-0.5">{s.customer} · {s.agent_type} · {s.channel}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="ret-card p-6 bg-[hsl(var(--brand-100))] border-[hsl(168_40%_82%)]">
            <p className="text-xs uppercase tracking-widest text-[hsl(var(--brand-ink))] font-semibold">How scoring works</p>
            <ul className="text-sm text-[hsl(var(--brand-ink))]/80 mt-3 space-y-1.5 list-disc list-inside">
              <li>7-dimension rubric against your QA standards</li>
              <li>Churn risk + dollar exposure estimate</li>
              <li>AI hallucination & policy compliance checks</li>
              <li>Generates coaching card and save playbook</li>
            </ul>
          </div>
        </div>
      </div>

      <style>{`.input{width:100%;padding:10px 12px;border:1px solid hsl(var(--line));border-radius:10px;background:#fff;font-size:14px;transition:border-color 120ms ease}.input:focus{outline:none;border-color:hsl(var(--brand));box-shadow:0 0 0 3px hsl(var(--brand-100))}`}</style>
    </DashboardLayout>
  );
}

const Field = ({ label, children, className = "" }) => (
  <label className={`block ${className}`}>
    <span className="block text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))] mb-1.5">{label}</span>
    {children}
  </label>
);
