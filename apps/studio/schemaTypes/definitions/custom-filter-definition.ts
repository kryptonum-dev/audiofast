import { Filter, Hash, Sliders } from "lucide-react";
import { defineField, defineType } from "sanity";

export const customFilterDefinition = defineType({
  name: "customFilterDefinition",
  title: "Definicja filtra",
  type: "object",
  icon: Filter,
  fields: [
    defineField({
      name: "name",
      title: "Nazwa filtra",
      type: "string",
      description:
        'Nazwa wyświetlana użytkownikowi (np. "Impedancja", "Długość kabla")',
      validation: (Rule) => Rule.required().error("Nazwa filtra jest wymagana"),
    }),
    defineField({
      name: "filterType",
      title: "Typ filtra",
      type: "string",
      description: "Wybierz jak filtr będzie wyświetlany na stronie",
      options: {
        list: [
          { title: "Lista rozwijana (dropdown)", value: "dropdown" },
          { title: "Zakres (suwak min-max)", value: "range" },
        ],
        layout: "radio",
      },
      initialValue: "dropdown",
      validation: (Rule) => Rule.required(),
    }),
    // Range-specific field: only unit is configurable
    // Min/max are computed dynamically from product values
    // Step is always 1 (hardcoded in frontend)
    defineField({
      name: "unit",
      title: "Jednostka",
      type: "string",
      description:
        'Jednostka dla zakresu (np. "Ω", "W", "m", "Hz"). Wartości min/max są obliczane automatycznie z produktów.',
      hidden: ({ parent }) => parent?.filterType !== "range",
    }),
  ],
  preview: {
    select: {
      name: "name",
      filterType: "filterType",
      unit: "unit",
    },
    prepare: ({ name, filterType, unit }) => ({
      title: name || "Filtr",
      subtitle:
        filterType === "range"
          ? `Zakres${unit ? ` (${unit})` : ""}`
          : "Lista rozwijana",
      media: filterType === "range" ? Sliders : Hash,
    }),
  },
});
