/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../src/**/*.{js,ts,jsx,tsx}", // obv fix this, should not use tailwind in package
  ],
  theme: {
    extend: {
      fontFamily: {
        openSans: ["Open Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};
