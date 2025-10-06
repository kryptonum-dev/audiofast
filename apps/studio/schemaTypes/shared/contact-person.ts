import { defineField } from 'sanity';

export const contactPersonField = defineField({
  name: 'contactPerson',
  title: 'Osoba kontaktowa',
  type: 'object',
  fields: [
    defineField({
      name: 'image',
      title: 'Zdjęcie osoby',
      type: 'image',
      description: 'Profesjonalne zdjęcie osoby kontaktowej',
      validation: (Rule) =>
        Rule.required().error('Zdjęcie osoby kontaktowej jest wymagane'),
    }),
    defineField({
      name: 'name',
      title: 'Imię i nazwisko',
      type: 'string',
      description: 'Pełne imię i nazwisko osoby kontaktowej',
      validation: (Rule) =>
        Rule.required().error('Imię i nazwisko jest wymagane'),
    }),
    defineField({
      name: 'phoneNumber',
      title: 'Numer telefonu',
      type: 'string',
      description: 'Numer telefonu w formacie +48 XXX XXX XXX',
      validation: (Rule) =>
        Rule.required().error('Numer telefonu jest wymagany'),
    }),
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'phoneNumber',
      media: 'image',
    },
  },
});
