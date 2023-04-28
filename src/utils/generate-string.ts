export const getString = () => {
  const length = (Math.floor(Math.random() * 10) % 10) + 10;
  let text = "";
  for (let i = 0; i < length; i++) {
    text += String.fromCharCode(65 + (Math.floor(Math.random() * 10) % 26));
  }
  return text;
};
