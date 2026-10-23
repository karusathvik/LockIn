document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("motivationForm");
  const status = document.getElementById("motivationStatus");
  const phrases = document.getElementById("phrases");
  let image = "";
  try {
    const { motivation = {} } = await chrome.storage.local.get("motivation");
    for (const id of ["goal", "nextStep", "workURL"]) document.getElementById(id).value = motivation[id] || "";
    phrases.value = (motivation.phrases || []).join("\n");
    image = motivation.image || "";
    document.getElementById("imageStatus").textContent = image ? "A personal image is saved." : "No personal image saved.";
  } catch (error) { status.textContent = error.message; }
  document.getElementById("importPhrases").onchange = async event => {
    try {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 64000) throw new Error("Use a phrase file smaller than 64 KB.");
      const imported = Motivation.parseQuotes(await file.text());
      phrases.value = imported.join("\n");
      status.textContent = `Loaded ${imported.length} phrases. Save reminders to apply.`;
    } catch (error) { status.textContent = "Import failed: " + error.message; }
    event.target.value = "";
  };
  document.getElementById("personalImage").onchange = async event => {
    try {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 1000000 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Choose a PNG, JPEG, or WebP smaller than 1 MB.");
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read the image."));
        reader.readAsDataURL(file);
      });
      const preview = new Image();
      preview.src = data;
      await preview.decode();
      image = data;
      document.getElementById("imageStatus").textContent = "Image selected. Save reminders to apply.";
    } catch (error) { status.textContent = error.message; }
    event.target.value = "";
  };
  document.getElementById("removeImage").onclick = () => {
    image = "";
    document.getElementById("imageStatus").textContent = "Image removed. Save reminders to apply.";
  };
  form.onsubmit = async event => {
    event.preventDefault();
    try {
      const motivation = {
        goal: document.getElementById("goal").value.trim(),
        nextStep: document.getElementById("nextStep").value.trim(),
        workURL: Motivation.workURL(document.getElementById("workURL").value),
        phrases: phrases.value.trim() ? Motivation.parseQuotes(phrases.value) : [],
        image
      };
      await chrome.storage.local.set({ motivation });
      status.textContent = "Reminders saved locally. Preview the blocked page to see them.";
    } catch (error) { status.textContent = error.message; }
  };
});
