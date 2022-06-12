import { useMemo, useState, useEffect } from 'react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/api/auth/[...nextauth]'
import { useStore, initializeStore } from '@/lib/store'

import Pagination from '@/components/pagination'
import BookmarkCard from '@/components/bookmark-card'
import Layout from '@/components/layout'
import EmptyDashboard from '@/components/empty-dashboard'
import DashboardHeader from '@/components/dashboard-header'
import QuickAdd from '@/components/quick-add'
import DataTable from '@/components/table'
import { viewTypes } from '@/lib/constants'
import prisma from '@/lib/prisma'

const PAGE_SIZE = 15

export default function Home() {
  const bookmarks = useStore((state) => state.bookmarks)
  const categories = useStore((state) => state.categories)
  const categoryFilter = useStore((state) => state.categoryFilter)
  const tagFilter = useStore((state) => state.tagFilter)
  const searchText = useStore((state) => state.searchText)
  const setUserSetting = useStore((state) => state.setUserSetting)
  const settings = useStore((state) => state.settings)

  const [filteredLength, setFilteredLength] = useState(bookmarks.length)
  const [currentPage, setCurrentPage] = useState(1)

  const currentTableData = useMemo(() => {
    const firstPageIndex = (currentPage - 1) * PAGE_SIZE
    const lastPageIndex = firstPageIndex + PAGE_SIZE
    return bookmarks
      .reduce((bookmarks, thisBookmark) => {
        if (categoryFilter || tagFilter) {
          // Filter shown bookmarks selected sidebar filters
          if (thisBookmark.categoryId === categoryFilter) {
            bookmarks.push(thisBookmark)
          } else if (thisBookmark.tags.some((tag) => tag.id === tagFilter)) {
            bookmarks.push(thisBookmark)
          }
        } else if (searchText) {
          // Filter shown bookmarks on search
          if (
            thisBookmark.url.toLowerCase().includes(searchText.toLowerCase()) ||
            thisBookmark.title
              ?.toLowerCase()
              .includes(searchText.toLowerCase()) ||
            thisBookmark.desc?.toLowerCase().includes(searchText.toLowerCase())
          ) {
            bookmarks.push(thisBookmark)
          }
        } else {
          bookmarks.push(thisBookmark)
        }
        setFilteredLength(bookmarks.length)
        return bookmarks
      }, [])
      .slice(firstPageIndex, lastPageIndex)
  }, [currentPage, categoryFilter, tagFilter, searchText, bookmarks])

  useEffect(() => {
    const getLanguage = () =>
      navigator.userLanguage ||
      (navigator.languages &&
        navigator.languages.length &&
        navigator.languages[0]) ||
      navigator.language ||
      navigator.browserLanguage ||
      navigator.systemLanguage ||
      'en-US'

    setUserSetting({ locale: getLanguage() })
  }, [setUserSetting])

  return (
    <Layout>
      <div className="flex h-full flex-col items-center space-y-2">
        <DashboardHeader />
        {bookmarks.length === 0 && <EmptyDashboard />}
        {bookmarks.length > 0 && currentTableData.length === 0 && (
          <div className="flex justify-center text-lg text-slate-700">
            No results found, please try again!
          </div>
        )}
        <div className="w-full grow overflow-x-hidden overflow-y-scroll">
          <section className="flex h-full flex-col items-center justify-start px-4">
            {currentTableData.length !== 0 &&
              settings.activeView === viewTypes.CARD.name && (
                <section className="grid w-full grid-cols-[repeat(auto-fit,_285px)] grid-rows-[repeat(auto-fit,_minmax(300px,_1fr))] items-start justify-items-start gap-4 px-4">
                  {currentTableData.map((bookmark) => (
                    <BookmarkCard
                      bookmark={bookmark}
                      key={bookmark.id}
                      categories={categories}
                    />
                  ))}
                </section>
              )}
            {currentTableData.length !== 0 &&
              settings.activeView === viewTypes.LIST.name && (
                <DataTable items={currentTableData} />
              )}
            {currentTableData.length !== 0 &&
              settings.activeView === viewTypes.DETAIL.name && (
                <div className="flex justify-center text-lg text-slate-700">
                  This view has not been implemented yet, please try Card or
                  List view
                </div>
              )}
          </section>
        </div>
        <Pagination
          currentPage={currentPage}
          totalCount={
            searchText || categoryFilter || tagFilter
              ? filteredLength
              : bookmarks.length
          }
          pageSize={PAGE_SIZE}
          onPageChange={(page) => setCurrentPage(page)}
        />
        <QuickAdd categories={categories} />
      </div>
    </Layout>
  )
}

export async function getServerSideProps(context) {
  const nextauth = await getServerSession(context, authOptions)
  const zustandStore = initializeStore()

  if (!nextauth) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    }
  }

  const bookmarkData = await prisma.bookmark.findMany({
    where: {
      userId: nextauth.user.userId,
    },
    include: {
      category: true,
      tags: { include: { tag: true } },
    },
  })

  const categories = await prisma.category.findMany({
    where: {
      userId: nextauth.user.userId,
    },
    include: {
      _count: {
        select: { bookmarks: true },
      },
    },
  })
  const tags = await prisma.tag.findMany({
    where: {
      userId: nextauth.user.userId,
    },
    include: {
      _count: {
        select: { bookmarks: true },
      },
    },
  })

  // Convert 'createdAt' to string to pass through as json
  const bookmarks = bookmarkData.map((boomark) => ({
    ...boomark,
    createdAt: boomark.createdAt.toString(),
    tags: boomark.tags.map((tag) => tag.tag),
  }))

  zustandStore.getState().setBookmarks(bookmarks)
  zustandStore.getState().setCategories(categories)
  zustandStore.getState().setTags(tags)

  return {
    props: {
      nextauth,
      initialZustandState: JSON.parse(JSON.stringify(zustandStore.getState())),
    },
  }
}