import prisma from '@/lib/prisma'
const metascraper = require('metascraper')([
  require('metascraper-description')(),
  require('metascraper-image')(),
  require('metascraper-title')(),
])

export default async function handler(req, res) {
  const { user_id, title, url, desc, image } = JSON.parse(req.body)

  try {
    let metadata = {
      title: '',
      image: '',
      description: '',
    }

    if (!title || !desc || !image) {
      const resp = await fetch(url)
      metadata = await metascraper({ html: await resp.text(), url: url })
    }

    await prisma.user.update({
      where: { id: user_id },
      data: {
        bookmarks: {
          upsert: {
            create: {
              url,
              title: title ?? metadata.title,
              image: image ?? metadata.image,
              desc: desc ?? metadata.description,
            },
            update: {
              url,
              title: title ?? metadata.title,
              image: image ?? metadata.image,
              desc: desc ?? metadata.description,
            },
            where: { url },
          },
        },
      },
    })
  } catch (error) {
    console.error('ERR', error)
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(500).json({ message: error })
  }

  res.setHeader('Access-Control-Allow-Origin', '*')
  return res.status(200).json({ message: 'Bookmark Added Successfully!' })
}