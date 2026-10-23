async function renderReminder() {
  const { motivation = {} } = await chrome.storage.local.get("motivation");
  document.getElementById("goalReminder").textContent = motivation.goal || "Return to what you planned to work on.";
  document.getElementById("nextReminder").textContent = motivation.nextStep ? "Next step: " + motivation.nextStep : "Choose one useful action you can do in the next two minutes.";
  document.getElementById("phrase").textContent = Motivation.dailyPhrase(motivation.phrases);
  const image = document.getElementById("motivationImage");
  image.hidden = true;
  if (/^data:image\/(png|jpeg|webp);base64,/.test(motivation.image || "")) {
    image.src = motivation.image;
    image.hidden = false;
  }
  const link = document.getElementById("returnWork");
  link.hidden = true;
  try {
    const url = Motivation.workURL(motivation.workURL);
    if (url) { link.href = url; link.hidden = false; }
  } catch {}
}
renderReminder().catch(console.error);
chrome.storage.onChanged.addListener(changes => {
  if (changes.motivation) renderReminder().catch(console.error);
});
