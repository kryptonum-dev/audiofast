import { Banknote, Mail } from "lucide-react";
import { defineField, defineType } from "sanity";

import { toPlainText } from "../../utils/helper";
import { formState } from "../definitions/form-state";
import { customPortableText } from "../portableText";
import { contactPeopleField } from "../shared";

const title = "Formularz Kontaktowy";

export const contactForm = defineType({
  name: "contactForm",
  title,
  icon: Mail,
  type: "object",
  description:
    "Sekcja z formularzem kontaktowym, osobami kontaktowymi i danymi bankowymi",
  fields: [
    customPortableText({
      name: "heading",
      title: "Nagłówek sekcji",
      description:
        'Główny tytuł sekcji kontaktowej, np. "Skontaktuj się z ekspertami AUDIOFAST"',
      type: "heading",
    }),
    customPortableText({
      name: "description",
      title: "Opis sekcji",
      description:
        "Krótki opis wprowadzający do sekcji, wyjaśniający jak można się skontaktować",
    }),
    contactPeopleField({
      conditionalValidation: false,
    }),
    defineField({
      name: "accountList",
      title: "Lista kont bankowych",
      type: "array",
      description: "Dodaj informacje o kontach bankowych (minimum 1)",
      of: [
        defineField({
          name: "account",
          title: "Konto bankowe",
          type: "object",
          fields: [
            customPortableText({
              name: "heading",
              title: "Nagłówek konta",
              description:
                'Tytuł konta, np. "Numery złotówkowych rachunków bankowych:", "EURO account IBAN:"',
              type: "heading",
            }),
            defineField({
              name: "accountDetails",
              title: "Szczegóły konta",
              type: "array",
              description:
                "Lista linii informacji o koncie (numery rachunków, SWIFT, adres banku)",
              of: [{ type: "string" }],
              validation: (Rule) => [
                Rule.min(1).error(
                  "Musisz dodać co najmniej jedną linię informacji",
                ),
                Rule.required().error("Szczegóły konta są wymagane"),
              ],
            }),
          ],
          preview: {
            select: {
              heading: "heading",
              details: "accountDetails",
            },
            prepare: ({ heading, details }) => {
              const getPolishLineForm = (count: number) => {
                if (count === 1) return "linia";
                if (count >= 2 && count <= 4) return "linie";
                return "linii";
              };

              return {
                title: toPlainText(heading) || "Konto bankowe",
                icon: Banknote,
                subtitle: details
                  ? `${details.length} ${getPolishLineForm(details.length)}`
                  : "Brak szczegółów",
              };
            },
          },
        }),
      ],
      validation: (Rule) => [
        Rule.min(1).error("Musisz dodać co najmniej jedno konto bankowe"),
        Rule.required().error("Lista kont bankowych jest wymagana"),
      ],
    }),
    formState,
  ],
  preview: {
    select: {
      heading: "heading",
      description: "description",
    },
    prepare: ({ heading, description }) => {
      return {
        title,
        subtitle:
          toPlainText(heading) ||
          toPlainText(description) ||
          "Formularz kontaktowy",
        media: Mail,
      };
    },
  },
});
