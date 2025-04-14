import {encode} from 'gpt-3-encoder'
import { tool } from "@langchain/core/tools";
import { z } from "zod";


const url = "https://propiedades_test.techbank.ai:4002/public/productos?limit=100"

const getPisos = 
    async() => {
   
        const response = await fetch(url, {})
        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }
        let pisos_found: any[] = []
        const pisos = await response.json();
        pisos.forEach((piso) => {
            const props = piso.PRODUCT_PROPS
            
         
            
            pisos_found.push(props)
        })
        
        
        
        
        return pisos_found;
    }
    

    // await getPisos()