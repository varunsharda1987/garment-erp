import { Request, Response } from 'express';
import prisma from '../config/database';
import { ValidationError } from '../errors';

/**
 * Get summary counts for all trim types
 * Returns total and active counts for each trim master
 */
export const getSummary = async (req: Request, res: Response) => {
  // Query all trim counts in parallel
  const [
    buttonsTotal,
    buttonsActive,
    zippersTotal,
    zippersActive,
    lacesTotal,
    lacesActive,
    threadsTotal,
    threadsActive,
    elasticTotal,
    elasticActive,
    labelsTotal,
    labelsActive,
  ] = await Promise.all([
    prisma.button_master.count(),
    prisma.button_master.count({ where: { isActive: true } }),
    prisma.zipper_master.count(),
    prisma.zipper_master.count({ where: { isActive: true } }),
    prisma.lace_master.count(),
    prisma.lace_master.count({ where: { isActive: true } }),
    prisma.thread_master.count(),
    prisma.thread_master.count({ where: { isActive: true } }),
    prisma.elastic_master.count(),
    prisma.elastic_master.count({ where: { isActive: true } }),
    prisma.label_master.count(),
    prisma.label_master.count({ where: { isActive: true } }),
  ]);

  const summary = {
    buttons: { count: buttonsTotal, active: buttonsActive },
    zippers: { count: zippersTotal, active: zippersActive },
    laces: { count: lacesTotal, active: lacesActive },
    threads: { count: threadsTotal, active: threadsActive },
    elastic: { count: elasticTotal, active: elasticActive },
    labels: { count: labelsTotal, active: labelsActive },
  };

  const total = buttonsTotal + zippersTotal + lacesTotal + threadsTotal + elasticTotal + labelsTotal;

  res.json({
    data: summary,
    total,
  });
};

/**
 * Search across all trim types with unified results
 * Supports filtering by type and text search
 */
export const searchAllTrims = async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 20,
    search = '',
    type = '', // BUTTON, ZIPPER, LACE, THREAD, ELASTIC, LABEL or empty for all
  } = req.query;

  const pageNum = Number(page);
  const limitNum = Number(limit);
  const searchStr = String(search).toLowerCase();
  const typeFilter = String(type).toUpperCase();

  // Define trim type configurations
  const trimConfigs = [
    {
      type: 'BUTTON',
      table: 'button_master',
      codeField: 'buttonCode',
      nameField: 'buttonName',
      priceField: 'pricePerPiece',
      unit: 'PIECE',
    },
    {
      type: 'ZIPPER',
      table: 'zipper_master',
      codeField: 'zipperCode',
      nameField: 'zipperName',
      priceField: 'pricePerPiece',
      unit: 'PIECE',
    },
    {
      type: 'LACE',
      table: 'lace_master',
      codeField: 'laceCode',
      nameField: 'laceName',
      priceField: null,
      unit: 'METER',
    },
    {
      type: 'THREAD',
      table: 'thread_master',
      codeField: 'threadCode',
      nameField: 'threadName',
      priceField: 'pricePerCone',
      unit: 'CONE',
    },
    {
      type: 'ELASTIC',
      table: 'elastic_master',
      codeField: 'elasticCode',
      nameField: 'elasticName',
      priceField: 'pricePerMeter',
      unit: 'METER',
    },
    {
      type: 'LABEL',
      table: 'label_master',
      codeField: 'labelCode',
      nameField: 'labelName',
      priceField: 'pricePerPiece',
      unit: 'PIECE',
    },
  ];

  // Filter by type if specified
  const activeConfigs = typeFilter ? trimConfigs.filter((c) => c.type === typeFilter) : trimConfigs;

  if (typeFilter && activeConfigs.length === 0) {
    throw new ValidationError(`Invalid trim type. Valid types: ${trimConfigs.map((c) => c.type).join(', ')}`);
  }

  // Fetch data from all relevant tables
  const allResults: any[] = [];

  for (const config of activeConfigs) {
    let items: any[] = [];

    // Build search condition
    const searchCondition = searchStr
      ? {
          OR: [
            { [config.codeField]: { contains: searchStr, mode: 'insensitive' as const } },
            { [config.nameField]: { contains: searchStr, mode: 'insensitive' as const } },
            { color: { contains: searchStr, mode: 'insensitive' as const } },
          ],
        }
      : {};

    switch (config.type) {
      case 'BUTTON':
        items = await prisma.button_master.findMany({
          where: { isActive: true, ...searchCondition },
          select: {
            id: true,
            buttonCode: true,
            buttonName: true,
            color: true,
            pricePerPiece: true,
            isActive: true,
            createdAt: true,
          },
        });
        break;
      case 'ZIPPER':
        items = await prisma.zipper_master.findMany({
          where: { isActive: true, ...searchCondition },
          select: {
            id: true,
            zipperCode: true,
            zipperName: true,
            color: true,
            pricePerPiece: true,
            isActive: true,
            createdAt: true,
          },
        });
        break;
      case 'LACE':
        items = await prisma.lace_master.findMany({
          where: { isActive: true, ...searchCondition },
          select: {
            id: true,
            laceCode: true,
            laceName: true,
            color: true,
            isActive: true,
            createdAt: true,
          },
        });
        break;
      case 'THREAD':
        items = await prisma.thread_master.findMany({
          where: { isActive: true, ...searchCondition },
          select: {
            id: true,
            threadCode: true,
            threadName: true,
            color: true,
            pricePerCone: true,
            isActive: true,
            createdAt: true,
          },
        });
        break;
      case 'ELASTIC':
        items = await prisma.elastic_master.findMany({
          where: { isActive: true, ...searchCondition },
          select: {
            id: true,
            elasticCode: true,
            elasticName: true,
            color: true,
            pricePerMeter: true,
            isActive: true,
            createdAt: true,
          },
        });
        break;
      case 'LABEL':
        items = await prisma.label_master.findMany({
          where: { isActive: true, ...searchCondition },
          select: {
            id: true,
            labelCode: true,
            labelName: true,
            color: true,
            pricePerPiece: true,
            isActive: true,
            createdAt: true,
          },
        });
        break;
    }

    // Transform to unified format
    const transformed = items.map((item) => ({
      id: item.id,
      code: item[config.codeField],
      name: item[config.nameField],
      type: config.type,
      color: item.color || null,
      price: config.priceField ? item[config.priceField] : null,
      unit: config.unit,
      isActive: item.isActive,
      createdAt: item.createdAt,
    }));

    allResults.push(...transformed);
  }

  // Sort by createdAt descending
  allResults.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Calculate pagination
  const total = allResults.length;
  const totalPages = Math.ceil(total / limitNum);
  const offset = (pageNum - 1) * limitNum;
  const paginatedResults = allResults.slice(offset, offset + limitNum);

  res.json({
    data: paginatedResults,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,
    },
  });
};

/**
 * Get recent trims across all types
 * Returns the latest items ordered by creation date
 */
export const getRecentTrims = async (req: Request, res: Response) => {
  const { limit = 10 } = req.query;
  const limitNum = Math.min(Number(limit), 50); // Cap at 50

  // Fetch recent items from each table
  const [buttons, zippers, laces, threads, elastic, labels] = await Promise.all([
    prisma.button_master.findMany({
      where: { isActive: true },
      select: { id: true, buttonCode: true, buttonName: true, color: true, pricePerPiece: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: limitNum,
    }),
    prisma.zipper_master.findMany({
      where: { isActive: true },
      select: { id: true, zipperCode: true, zipperName: true, color: true, pricePerPiece: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: limitNum,
    }),
    prisma.lace_master.findMany({
      where: { isActive: true },
      select: { id: true, laceCode: true, laceName: true, color: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: limitNum,
    }),
    prisma.thread_master.findMany({
      where: { isActive: true },
      select: { id: true, threadCode: true, threadName: true, color: true, pricePerCone: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: limitNum,
    }),
    prisma.elastic_master.findMany({
      where: { isActive: true },
      select: { id: true, elasticCode: true, elasticName: true, color: true, pricePerMeter: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: limitNum,
    }),
    prisma.label_master.findMany({
      where: { isActive: true },
      select: { id: true, labelCode: true, labelName: true, color: true, pricePerPiece: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: limitNum,
    }),
  ]);

  // Transform to unified format
  const allItems = [
    ...buttons.map((b) => ({
      id: b.id,
      code: b.buttonCode,
      name: b.buttonName,
      type: 'BUTTON',
      color: b.color,
      price: b.pricePerPiece,
      unit: 'PIECE',
      createdAt: b.createdAt,
    })),
    ...zippers.map((z) => ({
      id: z.id,
      code: z.zipperCode,
      name: z.zipperName,
      type: 'ZIPPER',
      color: z.color,
      price: z.pricePerPiece,
      unit: 'PIECE',
      createdAt: z.createdAt,
    })),
    ...laces.map((l) => ({
      id: l.id,
      code: l.laceCode,
      name: l.laceName,
      type: 'LACE',
      color: l.color,
      price: null,
      unit: 'METER',
      createdAt: l.createdAt,
    })),
    ...threads.map((t) => ({
      id: t.id,
      code: t.threadCode,
      name: t.threadName,
      type: 'THREAD',
      color: t.color,
      price: t.pricePerCone,
      unit: 'CONE',
      createdAt: t.createdAt,
    })),
    ...elastic.map((e) => ({
      id: e.id,
      code: e.elasticCode,
      name: e.elasticName,
      type: 'ELASTIC',
      color: e.color,
      price: e.pricePerMeter,
      unit: 'METER',
      createdAt: e.createdAt,
    })),
    ...labels.map((l) => ({
      id: l.id,
      code: l.labelCode,
      name: l.labelName,
      type: 'LABEL',
      color: l.color,
      price: l.pricePerPiece,
      unit: 'PIECE',
      createdAt: l.createdAt,
    })),
  ];

  // Sort by createdAt descending and limit
  allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const recent = allItems.slice(0, limitNum);

  res.json({
    data: recent,
    count: recent.length,
  });
};
