"use client"
import { useEffect } from "react"

export default function RevealObserver() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("qb-in")
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 }
    )

    // Observa todo lo que ya existe al montar (como antes).
    document.querySelectorAll(".qb-reveal").forEach((el) => observer.observe(el))

    // Ademas, vigila el resto del documento por si se agregan elementos
    // .qb-reveal DESPUES del montaje inicial — por ejemplo, tarjetas que
    // llegan por un fetch (testimonios, novedades, etc.). Sin esto, esos
    // elementos se quedan con opacity:0 para siempre porque nadie los
    // observa nunca.
    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((nodo) => {
          if (!(nodo instanceof HTMLElement)) return
          if (nodo.classList.contains("qb-reveal")) {
            observer.observe(nodo)
          }
          nodo.querySelectorAll?.(".qb-reveal").forEach((el) => observer.observe(el))
        })
      }
    })
    mutationObserver.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mutationObserver.disconnect()
    }
  }, [])

  return null
}