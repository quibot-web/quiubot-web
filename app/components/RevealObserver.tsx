"use client"
import { useEffect } from "react"

export default function RevealObserver() {
  useEffect(() => {
    const elementos = document.querySelectorAll(".qb-reveal")
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
    elementos.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return null
}