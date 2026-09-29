// Decorative background: an aurora gradient with slow-moving color fields
// and abstract shapes that the frosted glass panels blur over.
export function Aurora() {
  return (
    <div className="aurora" aria-hidden>
      {/* Soft color fields */}
      <div className="aurora-field left-[-10vw] top-[10vh] h-[45vw] w-[60vw] bg-indigo-600" />
      <div
        className="aurora-field right-[-15vw] top-[30vh] h-[40vw] w-[50vw] bg-teal-500/80"
        style={{ animationDuration: "34s", animationDirection: "alternate-reverse" }}
      />
      <div
        className="aurora-field bottom-[-20vw] left-[25vw] h-[40vw] w-[55vw] bg-blue-900"
        style={{ animationDuration: "40s" }}
      />

      {/* Floating geometric shapes */}
      <div className="aurora-shape left-[8%] top-[18%] h-56 w-56 rounded-full border-[6px] border-teal-300/40 bg-gradient-to-br from-teal-300/20 to-transparent" />
      <div
        className="aurora-shape right-[10%] top-[8%] h-40 w-40 rotate-12 rounded-[2.5rem] border-2 border-indigo-200/30 bg-gradient-to-br from-indigo-400/50 to-indigo-900/10"
        style={{ animationDuration: "38s", animationDirection: "alternate-reverse" }}
      />
      <div
        className="aurora-shape bottom-[12%] right-[22%] h-48 w-52 bg-gradient-to-tr from-teal-400/30 to-indigo-500/30 [clip-path:polygon(50%_0,100%_100%,0_100%)]"
        style={{ animationDuration: "44s" }}
      />
      <div
        className="aurora-shape bottom-[20%] left-[15%] h-24 w-24 rounded-full bg-indigo-400/30 blur-sm"
        style={{ animationDuration: "28s", animationDirection: "alternate-reverse" }}
      />
      <div
        className="aurora-shape left-[48%] top-[42%] h-72 w-72 rounded-full border-[3px] border-indigo-300/30"
        style={{ animationDuration: "50s" }}
      />
    </div>
  );
}
