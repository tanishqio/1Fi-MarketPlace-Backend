import express from "express";
import cors from "cors";
const app = express();
app.use(express.json());
app.use(cors({
    origin: [
        "http://localhost:3000",
        "https://frontend.vercel.app"
    ]
}));
import { prisma } from "./prisma/db";

app.get("/api/topbrands/:categoryname", async (req, res) => {
    const categoryname = req.params.categoryname;
    const categoryId = await prisma.categories.findUnique({
        where: {
            Name: categoryname
        }, select: {
            id: true
        }
    });
    const topbrands = await prisma.brands.findMany({
        where: {
            product: {
                some: {
                    categoryId: categoryId?.id
                }
            }
        },
        select: {
            id: true,
            Name: true,
            logoUrl: true
        }
    })
    return res.json({
        message: "top brands for given category",
        topbrands: topbrands
    })
});

// currently we are only sending price with it using vrinat
app.get("/api/featuredproducts", async (req, res) => {
    const featuredproducts = await prisma.products.findMany({
        where: {
            Rating: { gte: 10 },
        },
        include: {
            variants: {
                orderBy: {
                    price: "asc"
                },
                take: 1,
                select: {
                    attributes: true,
                    price: true,
                    stock: true
                }
            },
        }
    })
    return res.json({
        message: "top brands for given category",
        featuredproducts: featuredproducts
    })
});

app.get("/api/getproductsbybrand/:brandname", async (req, res) => {
    const brandname = req.params.brandname;
    const brand = await prisma.brands.findUnique({
        where: {
            Name: brandname
        }, select: { id: true }
    });
    const allproducts = await prisma.products.findMany({
        where: {
            brandId: brand?.id,
        },
        include: {
            variants: {
                orderBy: {
                    price: "asc"
                },
                take: 1,
                select: {
                    attributes: true,
                    price: true,
                    stock: true
                }
            },
        }
    })
    return res.json({
        message: "all products of a given brand",
        allproducts: allproducts
    })
});


app.post("/addcategory", async (req, res) => {
    const name = req.body.name;
    const imageurl = req.body.url;
    const newcat = await prisma.categories.create({
        data: {
            Name: name,
            ImageUrl: imageurl
        }
    })

    return res.status(201).json({
        message: "new category has been created",
        newCategory: newcat
    })
});


app.post("/addbrands", async (req, res) => {
    const name = req.body.name;
    const logourl = req.body.url;
    const newbrand = await prisma.brands.create({
        data: {
            Name: name,
            logoUrl: logourl
        }
    })

    return res.status(201).json({
        message: "new brand has been created",
        newCategory: newbrand
    })
});

app.post("/addproduct", async (req, res) => {
    const name = req.body.name;
    const imageurl = req.body.url;
    const brandId = req.body.brandId;
    const categoryId = req.body.categoryId;
    const Rating = req.body.Rating;

    const newproduct = await prisma.products.create({
        data: {
            Name: name,
            ImageUrl: imageurl,
            brandId: brandId,
            categoryId: categoryId,
            Rating: Rating
        }
    })

    return res.status(201).json({
        message: "new product has been added",
        newCategory: newproduct
    })
});

app.post("/addproductcvariant/:productid", async (req, res) => {
    const productId = Number(req.params.productid);
    const sku = req.body.sku;
    const price = req.body.price;
    const stock = req.body.stock;
    const attributes = req.body.attributes;

    const newproductvariant = await prisma.productVariant.create({
        data: {
            ProductId: productId,
            sku: sku,
            price: price,
            stock: stock,
            attributes: attributes
        }
    })

    return res.status(201).json({
        message: "new product variant has been added",
        newproductvariant: newproductvariant
    })
});


const PORT = Number(process.env.PORT);

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
