const $ = id => document.getElementById(id);
let state = {
  name: "", email: "", className: "", kkm: 75, url: "", questionsText: "",
  form: null, answers: [], prefillUrl: null
};

function page(n) {
  document.querySelectorAll(".page").forEach(el => el.classList.toggle("active", el.dataset.p === String(n)));
  $("step").textContent = `${n} / 5`;
  window.scrollTo({top:0, behavior:"smooth"});
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

async function apiJson(response) {
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch {}
  if (!response.ok) {
    const msg = typeof data?.error === "string" ? data.error :
      typeof data?.message === "string" ? data.message : null;
    const snippet = raw.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,240);
    throw new Error(msg ? `${msg} (HTTP ${response.status})` :
      `Server mengembalikan respons non-JSON (HTTP ${response.status})${snippet ? `: ${snippet}` : "."}`);
  }
  if (!data || typeof data !== "object") throw new Error("Respons server bukan JSON.");
  if (data.ok === false || data.error) throw new Error(data.error || "Permintaan gagal.");
  return data;
}

function readInputs() {
  state = {
    ...state,
    name: $("name").value.trim(),
    email: $("email").value.trim(),
    className: $("className").value.trim(),
    kkm: Number($("kkm").value),
    url: $("url").value.trim(),
    questionsText: $("questions").value.trim(),
    form: null, answers: [], prefillUrl: null
  };
}

function showFormPreview(form) {
  const questions = form.questions || [];
  $("inspectBox").hidden = false;
  $("inspectBox").innerHTML = `
    <div class="inspect-title">✓ Form terbaca: ${questions.length} soal</div>
    <div class="muted">Data identitas akan dipisahkan dari soal. Contoh soal yang ditemukan:</div>
    <ul class="question-list">
      ${questions.slice(0,12).map((q,i) => `<li><b>${i+1}.</b> ${esc(q.title)}${q.options?.length ? `<br><span class="muted">${esc(q.options.join(" • "))}</span>` : ""}</li>`).join("")}
    </ul>
    ${questions.length > 12 ? `<div class="muted" style="margin-top:8px">+ ${questions.length-12} soal lainnya</div>` : ""}
  `;
}

async function inspectForm() {
  $("checks").innerHTML = `
    <div class="check ok">Data peserta siap</div>
    <div class="check">Membaca struktur Google Form...</div>
    <div class="check">Menyiapkan pemeriksaan AI...</div>
  `;
  $("continueToPreview").disabled = true;
  $("inspectBox").hidden = true;

  if (!state.url) {
    $("checks").innerHTML = `
      <div class="check ok">Data peserta siap</div>
      <div class="check ok">Soal manual siap</div>
      <div class="check ok">Server AI siap digunakan</div>
    `;
    $("conn").textContent = "Soal manual siap.";
    $("continueToPreview").disabled = false;
    return;
  }

  try {
    const r = await fetch("/api/inspect", {
      method:"POST",
      headers:{"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify({formUrl:state.url})
    });
    const d = await apiJson(r);
    state.form = d;
    $("conn").textContent = `Form terbaca • ${d.questionCount} soal`;
    $("checks").innerHTML = `
      <div class="check ok">Data peserta siap</div>
      <div class="check ok">Google Form terbaca</div>
      <div class="check ok">Server AI siap digunakan</div>
    `;
    showFormPreview(d);
    $("continueToPreview").disabled = d.questionCount === 0;
  } catch (e) {
    $("conn").textContent = "Form belum dapat dibaca.";
    $("checks").innerHTML = `
      <div class="check ok">Data peserta siap</div>
      <div class="check bad">${esc(e.message)}</div>
    `;
    $("inspectBox").hidden = false;
    $("inspectBox").innerHTML = `<div class="inspect-title">Yang perlu diperiksa</div>
      <div class="muted">Buka URL Google Form di jendela Incognito. Jika form meminta login, ubah akses responden agar bisa dibuka tanpa login.</div>`;
    $("continueToPreview").disabled = true;
  }
}

$("start").onclick = async () => {
  readInputs();
  $("formError").hidden = true;

  if (!state.name) {
    $("formError").textContent = "Nama wajib diisi.";
    $("formError").hidden = false;
    return;
  }
  if (!Number.isFinite(state.kkm) || state.kkm < 0 || state.kkm > 100) {
    $("formError").textContent = "KKM harus antara 0 sampai 100.";
    $("formError").hidden = false;
    return;
  }
  if (!state.url && !state.questionsText) {
    $("formError").textContent = "Masukkan URL Google Form atau tempel soal manual.";
    $("formError").hidden = false;
    return;
  }
  if (state.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)) {
    $("formError").textContent = "Format email tidak valid.";
    $("formError").hidden = false;
    return;
  }

  page(2);
  await inspectForm();
};

$("continueToPreview").onclick = () => {
  $("student").textContent = `${state.name}${state.className ? " • " + state.className : ""}`;
  $("kkmshow").textContent = `KKM ${state.kkm}`;
  $("count").textContent = state.url
    ? `${state.form?.questionCount || 0} soal ditemukan`
    : "Soal manual";

  if (state.url && state.form) {
    $("preview").innerHTML = state.form.questions.slice(0,20).map((q,i) =>
      `<div class="q"><div class="qtitle">${i+1}. ${esc(q.title)}</div>
       ${q.options?.length ? `<div class="qopts">${esc(q.options.map((o,j)=>`${String.fromCharCode(65+j)}. ${o}`).join("\n"))}</div>` : `<div class="qopts">Jawaban teks</div>`}</div>`
    ).join("") + (state.form.questions.length > 20 ? `<div class="muted">Menampilkan 20 soal pertama. Semua soal tetap dikirim ke AI.</div>` : "");
  } else {
    $("preview").innerHTML = `<div class="q"><div class="qtitle">Soal manual</div><div class="qopts">${esc(state.questionsText.slice(0,8000))}</div></div>`;
  }
  page(3);
};

$("edit").onclick = () => page(1);
$("back").onclick = () => page(1);

async function runAnalysis() {
  page(4);
  $("bar").style.width = "12%";
  $("analysis").textContent = "Menganalisis soal...";
  $("analysisStatus").textContent = "Mengirim struktur soal ke Gemini...";
  $("analysisError").hidden = true;
  $("retry").hidden = true;
  $("cancel").hidden = true;
  $("loader").classList.remove("done");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55000);

  try {
    const payload = {
      name: state.name,
      email: state.email,
      className: state.className,
      kkm: state.kkm,
      formUrl: state.url || undefined,
      questions: state.url ? undefined : state.questionsText
    };

    $("bar").style.width = "30%";
    const response = await fetch("/api/analyze", {
      method:"POST",
      headers:{"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify(payload),
      signal:controller.signal
    });
    $("bar").style.width = "78%";
    const data = await apiJson(response);

    state.answers = Array.isArray(data.answers) ? data.answers : [];
    state.prefillUrl = data.prefillUrl || null;

    $("bar").style.width = "100%";
    $("analysisStatus").textContent = `Selesai • ${data.answeredCount}/${data.questionCount} soal dijawab`;
    await new Promise(r => setTimeout(r,350));

    renderResult(data);
    page(5);
  } catch (e) {
    $("loader").classList.add("done");
    $("bar").style.width = "100%";
    $("analysis").textContent = "Analisis gagal";
    $("analysisStatus").textContent = e?.name === "AbortError"
      ? "Request terlalu lama dan dihentikan agar tidak menggantung."
      : "Server mengembalikan error.";
    $("analysisError").textContent = e?.name === "AbortError"
      ? "Coba lagi. Jika tetap lama, gunakan soal yang lebih sedikit atau cek status API Gemini."
      : (e?.message || "Analisis gagal.");
    $("analysisError").hidden = false;
    $("retry").hidden = false;
    $("cancel").hidden = false;
  } finally {
    clearTimeout(timer);
  }
}

function renderResult(data) {
  $("answered").textContent = data.answeredCount ?? state.answers.length;
  $("total").textContent = data.questionCount ?? "-";
  $("finalKkm").textContent = state.kkm;
  $("status").textContent = "BELUM DINILAI";

  $("answers").innerHTML = state.answers.length
    ? state.answers.map((x,i) => {
        const answer = Array.isArray(x.answer) ? x.answer.join(", ") : x.answer;
        return `<div class="answer">
          <div class="answer-title">${i+1}. ${esc(x.question)}</div>
          <div>Jawaban: <strong>${esc(answer || "Tidak yakin")}</strong></div>
          ${x.reason ? `<div class="why">${esc(x.reason)}</div>` : ""}
        </div>`;
      }).join("")
    : `<div class="notice warn">AI tidak menghasilkan jawaban yang dapat dipetakan ke soal.</div>`;

  const warnings = Array.isArray(data.warnings) ? data.warnings : [];
  $("warnings").hidden = !warnings.length;
  $("warnings").innerHTML = warnings.length
    ? `<b>Catatan pemetaan</b><br>${warnings.map(esc).join("<br>")}`
    : "";

  const fields = Array.isArray(data.prefillFields) ? data.prefillFields : [];
  $("prefillInfo").textContent = data.prefillUrl
    ? `${fields.length} field berhasil dipetakan. Nama/Kelas/Email dan jawaban yang cocok akan terisi saat form dibuka.`
    : "Link prefill belum tersedia.";
  $("openFormResult").disabled = !data.prefillUrl && !state.url;
}

$("analyze").onclick = runAnalysis;
$("retry").onclick = runAnalysis;
$("cancel").onclick = () => page(3);

$("openFormResult").onclick = () => {
  const target = state.prefillUrl || state.url;
  if (target) window.open(target, "_blank", "noopener,noreferrer");
};
